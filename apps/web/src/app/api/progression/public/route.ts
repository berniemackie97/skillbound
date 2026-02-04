import {
  ALL_BOSSES,
  ALL_GEAR_STAGES,
  ALL_MILESTONES,
  characterProfiles,
  characterSnapshots,
  desc,
  eq,
} from '@skillbound/database';
import type { CharacterFacts } from '@skillbound/domain';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getLatestContentBundle } from '@/lib/content/content-bundles';
import { createProblemDetails } from '@/lib/api/problem-details';
import {
  buildCharacterFactsFromSnapshot,
} from '@/lib/requirements/requirements-context';
import {
  evaluateBundleCombatAchievements,
  evaluateBundleDiaries,
  evaluateBundleQuests,
} from '@/lib/requirements/requirements-evaluator';
import { enrichFactsWithRuneLiteData } from '@/lib/character/runelite-facts';
import { toProgressSnapshot } from '@/lib/snapshots/snapshots';
import { getDbClient } from '@/lib/db';

const querySchema = z.object({
  profileId: z.string().uuid(),
});

/**
 * GET /api/progression/public?profileId={id}
 *
 * Public, read-only progression data for a character profile.
 */
export async function GET(request: NextRequest) {
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
    const [profile] = await db
      .select()
      .from(characterProfiles)
      .where(eq(characterProfiles.id, parsed.data.profileId))
      .limit(1);

    if (!profile) {
      const problem = createProblemDetails({
        status: 404,
        title: 'Character not found',
      });
      return NextResponse.json(problem, { status: problem.status });
    }

    const [latestSnapshot] = await db
      .select()
      .from(characterSnapshots)
      .where(eq(characterSnapshots.profileId, profile.id))
      .orderBy(desc(characterSnapshots.capturedAt))
      .limit(1);

    const bundle = await getLatestContentBundle();

    let requirements: {
      quests: ReturnType<typeof evaluateBundleQuests>;
      diaries: ReturnType<typeof evaluateBundleDiaries>;
      combat: ReturnType<typeof evaluateBundleCombatAchievements>;
    } | null = null;

    let requirementsError: string | null = null;
    let requirementsMeta:
      | {
          capturedAt?: string;
          dataSource?: string | null;
          dataSourceWarning?: string | null;
        }
      | null = null;

    if (latestSnapshot) {
      const progressSnapshot = toProgressSnapshot(latestSnapshot);
      let facts: CharacterFacts = buildCharacterFactsFromSnapshot(
        progressSnapshot.skills,
        [],
        progressSnapshot.activities
      );
      facts = enrichFactsWithRuneLiteData(facts, latestSnapshot, bundle);

      requirements = {
        quests: evaluateBundleQuests(bundle, facts),
        diaries: evaluateBundleDiaries(bundle, facts),
        combat: evaluateBundleCombatAchievements(bundle, facts),
      };

      requirementsMeta = {
        capturedAt: latestSnapshot.capturedAt.toISOString(),
        dataSource: latestSnapshot.dataSource,
        dataSourceWarning: latestSnapshot.dataSourceWarning,
      };
    } else {
      requirementsError = 'No snapshots available for this character yet.';
    }

    const activityMap = latestSnapshot?.activities ?? null;
    const bosses = ALL_BOSSES.map((boss) => {
      const key = slugifyKey(boss.name);
      const score = activityMap?.[key];
      return {
        id: key,
        bossName: boss.name,
        killcount: typeof score === 'number' && score >= 0 ? score : 0,
        personalBest: null,
      };
    });

    const gear = Object.entries(ALL_GEAR_STAGES).flatMap(([stage, items]) =>
      items.map((item) => ({
        id: `gear_${stage}_${slugifyKey(item.itemName)}`,
        gameStage: stage as 'early' | 'mid' | 'late' | 'end' | 'specialized',
        slot: item.slot,
        itemName: item.itemName,
        source: item.source,
        obtained: false,
        priority: item.priority,
      }))
    );

    const milestones = Object.entries(ALL_MILESTONES).flatMap(
      ([difficulty, items]) =>
        items.map((item) => ({
          id: `milestone_${difficulty}_${slugifyKey(item.name)}`,
          difficulty: difficulty as
            | 'easy'
            | 'medium'
            | 'hard'
            | 'elite'
            | 'master',
          name: item.name,
          description: item.description ?? null,
          achieved: false,
        }))
    );

    return NextResponse.json({
      data: {
        bosses,
        collectionLog: [],
        gear,
        milestones,
        requirements,
        activities: activityMap,
      },
      meta: {
        bossCount: bosses.length,
        collectionLogCount: 0,
        gearCount: gear.length,
        milestoneCount: milestones.length,
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
