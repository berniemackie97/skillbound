import {
  bossKillcounts,
  characterOverrides,
  characterProfiles,
  characterSnapshots,
  characterState,
  collectionLogItems,
  desc,
  eq,
  gearProgression,
  milestones,
  userCharacters,
} from '@skillbound/database';
import type { CharacterFacts } from '@skillbound/domain';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionUser, unauthorizedResponse } from '@/lib/auth/auth-helpers';
import { getLatestContentBundle } from '@/lib/content/content-bundles';
import { mapCombatAchievementsToContentIds } from '@/lib/content/combat-achievement-mapper';
import { getDbClient } from '@/lib/db';
import { createProblemDetails } from '@/lib/api/problem-details';
import {
  applyOverrides,
  applyCharacterState,
  buildCharacterFactsFromSnapshot,
} from '@/lib/requirements/requirements-context';
import {
  evaluateBundleCombatAchievements,
  evaluateBundleDiaries,
  evaluateBundleQuests,
} from '@/lib/requirements/requirements-evaluator';
import { enrichFactsWithRuneLiteData } from '@/lib/character/runelite-facts';
import { applyQuestPoints } from '@/lib/character/quest-points';
import { toProgressSnapshot } from '@/lib/snapshots/snapshots';

const querySchema = z.object({
  characterId: z.string().uuid(),
});

/**
 * GET /api/progression/comprehensive?characterId={id}
 * Get all progression data for a character in one request
 */
export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return unauthorizedResponse();
  }

  const searchParams = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = querySchema.safeParse(searchParams);

  if (!parsed.success) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid query parameters',
      errors: parsed.error.issues,
    });
    return NextResponse.json(problem, { status: problem.status });
  }

  try {
    const db = getDbClient();

    // Verify character ownership
    const [character] = await db
      .select({
        userCharacter: userCharacters,
        profile: characterProfiles,
      })
      .from(userCharacters)
      .innerJoin(
        characterProfiles,
        eq(userCharacters.profileId, characterProfiles.id)
      )
      .where(eq(userCharacters.id, parsed.data.characterId))
      .limit(1);

    if (!character || character.userCharacter.userId !== user.id) {
      const problem = createProblemDetails({
        status: 404,
        title: 'Character not found',
      });
      return NextResponse.json(problem, { status: problem.status });
    }

    // Fetch all progression data in parallel
    const [bosses, collectionLog, gear, goals, latestSnapshot, overrides, stateData] =
      await Promise.all([
        db
          .select()
          .from(bossKillcounts)
          .where(eq(bossKillcounts.userCharacterId, parsed.data.characterId)),
        db
          .select()
          .from(collectionLogItems)
          .where(eq(collectionLogItems.userCharacterId, parsed.data.characterId)),
        db
          .select()
          .from(gearProgression)
          .where(eq(gearProgression.userCharacterId, parsed.data.characterId)),
        db
          .select()
          .from(milestones)
          .where(eq(milestones.userCharacterId, parsed.data.characterId)),
        db
          .select()
          .from(characterSnapshots)
          .where(eq(characterSnapshots.profileId, character.profile.id))
          .orderBy(desc(characterSnapshots.capturedAt))
          .limit(1)
          .then((rows) => rows[0]),
        db
          .select()
          .from(characterOverrides)
          .where(eq(characterOverrides.userCharacterId, parsed.data.characterId)),
        // Fetch character_state data for quests, diaries, combat achievements
        db
          .select()
          .from(characterState)
          .where(eq(characterState.userCharacterId, parsed.data.characterId)),
      ]);

    const bundle = await getLatestContentBundle();

    // We can evaluate requirements if we have a snapshot OR state data
    const hasSnapshot = !!latestSnapshot;
    const hasStateData = stateData.length > 0;
    const canEvaluate = hasSnapshot || hasStateData;

    const requirements: {
      quests: ReturnType<typeof evaluateBundleQuests>;
      diaries: ReturnType<typeof evaluateBundleDiaries>;
      combat: ReturnType<typeof evaluateBundleCombatAchievements>;
    } | null = canEvaluate
      ? {
          quests: [],
          diaries: [],
          combat: [],
        }
      : null;

    let requirementsError: string | null = null;
    let requirementsMeta:
      | {
          capturedAt?: string;
          dataSource?: string | null;
          dataSourceWarning?: string | null;
        }
      | null = null;

    if (canEvaluate && requirements) {
      // Build facts from snapshot if available, otherwise start with empty facts
      let facts: CharacterFacts;
      if (latestSnapshot) {
        const progressSnapshot = toProgressSnapshot(latestSnapshot);
        facts = buildCharacterFactsFromSnapshot(
          progressSnapshot.skills,
          [],
          progressSnapshot.activities
        );
        // Enrich with RuneLite data from snapshot (quests, diaries, etc.)
        facts = enrichFactsWithRuneLiteData(facts, latestSnapshot, bundle);
      } else {
        // No snapshot - start with empty facts, state data will populate completions
        facts = { skillLevels: {} };
      }

      // Apply character_state data (this is the new unified state table)
      // This includes quest/diary/achievement completions that may be set
      // via guides, manual toggles, or other sources
      facts = applyCharacterState(facts, stateData);

      if (
        latestSnapshot?.combatAchievements &&
        latestSnapshot.combatAchievements.length > 0
      ) {
        const completionMap = { ...(facts.combatAchievements ?? {}) };
        const mapped = await mapCombatAchievementsToContentIds(
          db,
          latestSnapshot.combatAchievements
        );
        Object.assign(completionMap, mapped);
        facts.combatAchievements = completionMap;
      }

      // Apply legacy overrides (character_overrides table)
      facts = applyOverrides(overrides, facts);
      facts = applyQuestPoints(facts, bundle);

      requirements.quests = evaluateBundleQuests(bundle, facts);
      requirements.diaries = evaluateBundleDiaries(bundle, facts);
      requirements.combat = evaluateBundleCombatAchievements(bundle, facts);

      if (latestSnapshot) {
        requirementsMeta = {
          capturedAt: latestSnapshot.capturedAt.toISOString(),
          dataSource: latestSnapshot.dataSource,
          dataSourceWarning: latestSnapshot.dataSourceWarning,
        };
      } else {
        requirementsMeta = {
          dataSource: 'character_state',
          dataSourceWarning: 'No hiscores snapshot - using saved state data only',
        };
      }
    } else {
      requirementsError = 'Character has not been synced yet.';
    }

    const activityMap = latestSnapshot?.activities ?? null;
    const bossesWithKc = activityMap
      ? bosses.map((boss) => {
          const key = slugifyKey(boss.bossName);
          const score = activityMap[key];
          if (typeof score === 'number' && score >= 0) {
            return { ...boss, killcount: score };
          }
          return boss;
        })
      : bosses;

    return NextResponse.json({
      data: {
        bosses: bossesWithKc,
        collectionLog,
        gear,
        milestones: goals,
        requirements,
        activities: activityMap,
      },
      meta: {
        bossCount: bosses.length,
        collectionLogCount: collectionLog.length,
        gearCount: gear.length,
        milestoneCount: goals.length,
        requirementsMeta,
        requirementsError,
      },
    });
  } catch (error) {
    const problem = createProblemDetails({
      status: 500,
      title: 'Failed to fetch progression data',
      detail: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(problem, { status: problem.status });
  }
}

function slugifyKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}
