import {
  and,
  asc,
  characterSnapshots,
  eq,
  gte,
  lte,
  userCharacters,
} from '@skillbound/database';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getDbClient } from '@/lib/db';
import { createProblemDetails } from '@/lib/api/problem-details';
import { summarizeSnapshotGains } from '@/lib/snapshots/snapshot-gains';

const paramsSchema = z.object({
  id: z.string().uuid(),
});

type RouteParams = Promise<{ id?: string }>;

const querySchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
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
    from: request.nextUrl.searchParams.get('from'),
    to: request.nextUrl.searchParams.get('to'),
  });

  if (!parsedQuery.success) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid range parameters',
      detail: 'from/to must be valid ISO datetimes.',
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

  const snapshots = await db
    .select()
    .from(characterSnapshots)
    .where(
      and(
        eq(characterSnapshots.profileId, row.profileId),
        gte(characterSnapshots.capturedAt, new Date(parsedQuery.data.from)),
        lte(characterSnapshots.capturedAt, new Date(parsedQuery.data.to))
      )
    )
    .orderBy(asc(characterSnapshots.capturedAt));

  const summary = summarizeSnapshotGains(snapshots);
  if (!summary) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Insufficient snapshots',
      detail: 'At least two snapshots are required to compute gains.',
    });

    return NextResponse.json(problem, { status: problem.status });
  }

  return NextResponse.json({
    data: {
      count: summary.count,
      fromSnapshotId: summary.fromSnapshotId,
      toSnapshotId: summary.toSnapshotId,
      fromCapturedAt: summary.fromCapturedAt.toISOString(),
      toCapturedAt: summary.toCapturedAt.toISOString(),
      durationMs: summary.durationMs,
      durationHours: summary.durationHours,
      durationDays: summary.durationDays,
      diff: summary.diff,
      rates: summary.rates,
    },
  });
}
