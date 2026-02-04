import {
  characterProfiles,
  characterOverrides,
  characterSnapshots,
  characterState,
  desc,
  eq,
  userCharacters,
} from '@skillbound/database';
import type { CharacterFacts } from '@skillbound/domain';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createProblemDetails } from '@/lib/api/problem-details';
import { applyQuestPoints } from '@/lib/character/quest-points';
import { enrichFactsWithRuneLiteData } from '@/lib/character/runelite-facts';
import { mapCombatAchievementsToContentIds } from '@/lib/content/combat-achievement-mapper';
import { getLatestContentBundle } from '@/lib/content/content-bundles';
import { getDbClient } from '@/lib/db';
import {
  applyOverrides,
  applyCharacterState,
  buildCharacterFactsFromSnapshot,
} from '@/lib/requirements/requirements-context';
import { evaluateBundleCombatAchievements } from '@/lib/requirements/requirements-evaluator';
import { toProgressSnapshot } from '@/lib/snapshots/snapshots';

const paramsSchema = z.object({
  id: z.string().uuid(),
});

type RouteParams = Promise<{ id?: string }>;

export async function GET(
  _request: NextRequest,
  { params }: { params: RouteParams }
) {
  const resolvedParams = await params;
  const parsedParams = paramsSchema.safeParse(resolvedParams);
  if (!parsedParams.success) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid character id',
      detail: 'Character id must be a valid UUID.',
    });

    return NextResponse.json(problem, { status: problem.status });
  }

  const db = getDbClient();
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
    .where(eq(userCharacters.id, parsedParams.data.id))
    .limit(1);

  if (!character?.userCharacter) {
    const problem = createProblemDetails({
      status: 404,
      title: 'Character not found',
      detail: 'No character exists for the supplied id.',
    });

    return NextResponse.json(problem, { status: problem.status });
  }

  try {
    const [latestSnapshot, overrides, stateData] = await Promise.all([
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
        .where(eq(characterOverrides.userCharacterId, parsedParams.data.id)),
      db
        .select()
        .from(characterState)
        .where(eq(characterState.userCharacterId, parsedParams.data.id)),
    ]);

    if (!latestSnapshot && stateData.length === 0) {
      const problem = createProblemDetails({
        status: 404,
        title: 'No progression data',
        detail: 'Character has not been synced yet.',
      });

      return NextResponse.json(problem, { status: problem.status });
    }

    let facts: CharacterFacts = { skillLevels: {} };
    if (latestSnapshot) {
      const progressSnapshot = toProgressSnapshot(latestSnapshot);
      facts = buildCharacterFactsFromSnapshot(
        progressSnapshot.skills,
        [],
        progressSnapshot.activities
      );
    }

    const bundle = await getLatestContentBundle();

    // Enrich facts with RuneLite data (quests, diaries, combat achievements)
    // Pass content bundle so diary task indices can be mapped to actual task IDs
    if (latestSnapshot) {
      facts = enrichFactsWithRuneLiteData(facts, latestSnapshot, bundle);
    }

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

    // Apply manual overrides AFTER RuneLite enrichment (overrides win)
    facts = applyOverrides(overrides, facts);
    facts = applyQuestPoints(facts, bundle);

    const results = evaluateBundleCombatAchievements(bundle, facts);

    return NextResponse.json({
      data: results,
      contentVersion: bundle.metadata.version,
      capturedAt: latestSnapshot?.capturedAt.toISOString() ?? null,
      dataSource: latestSnapshot?.dataSource ?? 'character_state',
      dataSourceWarning: latestSnapshot?.dataSourceWarning ?? null,
    });
  } catch (error) {
    console.error('Combat achievement evaluation error:', error);
    const problem = createProblemDetails({
      status: 500,
      title: 'Requirements evaluation failed',
      detail: 'Unable to evaluate combat achievements.',
    });

    return NextResponse.json(problem, { status: problem.status });
  }
}
