import {
  characterProfiles,
  characterSnapshots,
  desc,
  eq,
  inArray,
  userCharacters,
} from '@skillbound/database';
import { diffSnapshots } from '@skillbound/domain';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { buildLatestSnapshotMap, parseCompareQuery } from '@/lib/compare/compare';
import { getDbClient } from '@/lib/db';
import { createProblemDetails } from '@/lib/api/problem-details';
import { toProgressSnapshot } from '@/lib/snapshots/snapshots';

export async function GET(request: NextRequest) {
  const parsedQuery = parseCompareQuery(request.nextUrl.searchParams);
  if (!parsedQuery.success) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid compare query',
      detail: 'Provide at least two valid character ids.',
      errors: parsedQuery.error.issues,
    });

    return NextResponse.json(problem, { status: problem.status });
  }

  const { characterIds } = parsedQuery.data;
  const db = getDbClient();

  const characterRows = await db
    .select({
      userCharacter: userCharacters,
      profile: characterProfiles,
    })
    .from(userCharacters)
    .innerJoin(
      characterProfiles,
      eq(userCharacters.profileId, characterProfiles.id)
    )
    .where(inArray(userCharacters.id, characterIds));

  if (characterRows.length !== characterIds.length) {
    const found = new Set(
      characterRows.map((row) => row.userCharacter.id)
    );
    const missing = characterIds.filter((id) => !found.has(id));

    const problem = createProblemDetails({
      status: 404,
      title: 'Characters not found',
      detail: 'One or more characters could not be found.',
      errors: missing.map((id) => ({ message: `Missing character ${id}` })),
    });

    return NextResponse.json(problem, { status: problem.status });
  }

  const profileIds = characterRows.map((row) => row.profile.id);
  const snapshotRows = await db
    .select()
    .from(characterSnapshots)
    .where(inArray(characterSnapshots.profileId, profileIds))
    .orderBy(desc(characterSnapshots.capturedAt));

  const latestSnapshots = buildLatestSnapshotMap(snapshotRows);
  const missingSnapshots = profileIds.filter(
    (id) => !latestSnapshots.has(id)
  );

  if (missingSnapshots.length > 0) {
    const problem = createProblemDetails({
      status: 404,
      title: 'Snapshots not found',
      detail: 'No snapshots were found for one or more characters.',
      errors: missingSnapshots.map((id) => ({
        message: `Missing snapshot for ${id}`,
      })),
    });

    return NextResponse.json(problem, { status: problem.status });
  }

  const characterMap = new Map(
    characterRows.map((row) => [row.userCharacter.id, row])
  );

  const entries = characterIds.map((id) => {
    const row = characterMap.get(id);
    const snapshot = row ? latestSnapshots.get(row.profile.id) : undefined;

    if (!row || !snapshot) {
      throw new Error('Missing compare data for character');
    }

    return {
      character: {
        id: row.userCharacter.id,
        displayName: row.profile.displayName,
        mode: row.profile.mode,
      },
      snapshotId: snapshot.id,
      capturedAt: snapshot.capturedAt,
      progress: toProgressSnapshot(snapshot),
    };
  });

  let diff = null;

  if (entries.length === 2) {
    const [from, to] = entries;
    if (from && to) {
      diff = diffSnapshots(from.progress, to.progress);
    }
  }

  return NextResponse.json({
    data: {
      entries,
      diff,
    },
  });
}
