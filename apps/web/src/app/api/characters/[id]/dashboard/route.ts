import {
  characterOverrides,
  characterProfiles,
  characterSnapshots,
  desc,
  eq,
  userCharacters,
} from '@skillbound/database';
import type { ProgressSnapshot } from '@skillbound/domain';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { mapErrorToResponse } from '@/lib/api/api-error-mapper';
import { createProblemDetails } from '@/lib/api/problem-details';
import { dbModeToHiscoresMode } from '@/lib/character/game-mode';
import { getHiscoresClient } from '@/lib/character/hiscores-client';
import { getLatestContentBundle } from '@/lib/content/content-bundles';
import { getDbClient } from '@/lib/db';
import { logger } from '@/lib/logging/logger';
import { summarizeCompletion } from '@/lib/progression/dashboard-summary';
import { buildCharacterFactsFromSnapshot } from '@/lib/requirements/requirements-context';
import {
  evaluateBundleDiaries,
  evaluateBundleQuests,
} from '@/lib/requirements/requirements-evaluator';
import {
  buildSnapshotInsert,
  toProgressSnapshot,
  toProgressSnapshotFromDraft,
} from '@/lib/snapshots/snapshots';

const paramsSchema = z.object({
  id: z.string().uuid(),
});

type RouteParams = Promise<{ id?: string }>;

export async function GET(
  request: NextRequest,
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
  const [row] = await db
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

  if (!row?.userCharacter || !row.profile) {
    const problem = createProblemDetails({
      status: 404,
      title: 'Character not found',
      detail: 'No character exists for the supplied id.',
    });

    return NextResponse.json(problem, { status: problem.status });
  }

  const overrides = await db
    .select()
    .from(characterOverrides)
    .where(eq(characterOverrides.userCharacterId, parsedParams.data.id));

  let snapshotSource: 'stored' | 'live' = 'stored';
  let progressSnapshot: ProgressSnapshot | null = null;
  let capturedAt: string | null = null;

  const [latestSnapshot] = await db
    .select()
    .from(characterSnapshots)
    .where(eq(characterSnapshots.profileId, row.profile.id))
    .orderBy(desc(characterSnapshots.capturedAt))
    .limit(1);

  if (latestSnapshot) {
    progressSnapshot = toProgressSnapshot(latestSnapshot);
    capturedAt = latestSnapshot.capturedAt.toISOString();
  } else {
    try {
      const hiscores = await getHiscoresClient().lookup(
        row.profile.displayName,
        dbModeToHiscoresMode(row.profile.mode)
      );
      const draft = buildSnapshotInsert(row.profile.id, hiscores);
      progressSnapshot = toProgressSnapshotFromDraft(draft);
      capturedAt = hiscores.capturedAt;
      snapshotSource = 'live';
    } catch (error) {
      logger.error({ err: error }, 'Dashboard hiscores error');
      return mapErrorToResponse(error, request.url);
    }
  }

  if (!progressSnapshot) {
    const problem = createProblemDetails({
      status: 500,
      title: 'Dashboard error',
      detail: 'Unable to resolve snapshot data for dashboard.',
    });

    return NextResponse.json(problem, { status: problem.status });
  }

  const facts = buildCharacterFactsFromSnapshot(
    progressSnapshot.skills,
    overrides,
    progressSnapshot.activities ?? undefined
  );

  const bundle = await getLatestContentBundle();
  const questResults = evaluateBundleQuests(bundle, facts);
  const diaryResults = evaluateBundleDiaries(bundle, facts);

  const questSummary = summarizeCompletion(
    questResults.map((quest) => quest.completionStatus)
  );

  const diaryTierStatuses = diaryResults.flatMap((diary) =>
    diary.tiers.map((tier) => tier.completionStatus)
  );
  const diarySummary = summarizeCompletion(diaryTierStatuses);

  return NextResponse.json({
    data: {
      character: row.userCharacter,
      profile: row.profile,
      snapshot: progressSnapshot,
      snapshotSource,
      capturedAt,
      completionSummary: {
        quests: questSummary,
        diaries: diarySummary,
      },
    },
    contentVersion: bundle.metadata.version,
  });
}
