import {
  and,
  characterSnapshots,
  desc,
  eq,
  userCharacters,
} from '@skillbound/database';
import { diffSnapshots } from '@skillbound/domain';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createProblemDetails } from '@/lib/api/problem-details';
import { getDbClient } from '@/lib/db';
import { toProgressSnapshot } from '@/lib/snapshots/snapshots';

const paramsSchema = z.object({
  id: z.string().uuid(),
});

type RouteParams = Promise<{ id?: string }>;

const querySchema = z.object({
  from: z.string().uuid().optional(),
  to: z.string().uuid().optional(),
});

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

  const parsedQuery = querySchema.safeParse({
    from: request.nextUrl.searchParams.get('from') ?? undefined,
    to: request.nextUrl.searchParams.get('to') ?? undefined,
  });

  if (!parsedQuery.success) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid diff parameters',
      detail: 'from/to must be valid snapshot UUIDs.',
      errors: parsedQuery.error.issues,
    });

    return NextResponse.json(problem, { status: problem.status });
  }

  const db = getDbClient();
  const [row] = await db
    .select({ profileId: userCharacters.profileId })
    .from(userCharacters)
    .where(eq(userCharacters.id, parsedParams.data.id))
    .limit(1);

  if (!row?.profileId) {
    const problem = createProblemDetails({
      status: 404,
      title: 'Character not found',
      detail: 'No character exists for the supplied id.',
    });

    return NextResponse.json(problem, { status: problem.status });
  }

  let previous;
  let current;

  if (parsedQuery.data.from && parsedQuery.data.to) {
    const snapshots = await db
      .select()
      .from(characterSnapshots)
      .where(
        and(
          eq(characterSnapshots.profileId, row.profileId),
          eq(characterSnapshots.id, parsedQuery.data.from)
        )
      );

    const [fromSnapshot] = snapshots;
    const [toSnapshot] = await db
      .select()
      .from(characterSnapshots)
      .where(
        and(
          eq(characterSnapshots.profileId, row.profileId),
          eq(characterSnapshots.id, parsedQuery.data.to)
        )
      );

    if (!fromSnapshot || !toSnapshot) {
      const problem = createProblemDetails({
        status: 404,
        title: 'Snapshot not found',
        detail: 'Requested snapshots were not found for this character.',
      });

      return NextResponse.json(problem, { status: problem.status });
    }

    previous =
      fromSnapshot.capturedAt <= toSnapshot.capturedAt
        ? fromSnapshot
        : toSnapshot;
    current =
      fromSnapshot.capturedAt <= toSnapshot.capturedAt
        ? toSnapshot
        : fromSnapshot;
  } else {
    const snapshots = await db
      .select()
      .from(characterSnapshots)
      .where(eq(characterSnapshots.profileId, row.profileId))
      .orderBy(desc(characterSnapshots.capturedAt))
      .limit(2);

    if (snapshots.length < 2) {
      const problem = createProblemDetails({
        status: 400,
        title: 'Insufficient snapshots',
        detail: 'At least two snapshots are required to compute a diff.',
      });

      return NextResponse.json(problem, { status: problem.status });
    }

    const [latest, previousSnapshot] = snapshots;
    if (!latest || !previousSnapshot) {
      const problem = createProblemDetails({
        status: 400,
        title: 'Insufficient snapshots',
        detail: 'At least two snapshots are required to compute a diff.',
      });

      return NextResponse.json(problem, { status: problem.status });
    }

    previous = previousSnapshot;
    current = latest;
  }

  const diff = diffSnapshots(
    toProgressSnapshot(previous),
    toProgressSnapshot(current)
  );

  return NextResponse.json({
    data: diff,
    fromSnapshotId: previous.id,
    toSnapshotId: current.id,
  });
}
