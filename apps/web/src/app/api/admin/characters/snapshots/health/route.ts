import {
  characterSnapshots,
  characterProfiles,
  desc,
  isNull,
  lt,
  or,
  sql,
} from '@skillbound/database';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createProblemDetails } from '@/lib/api/problem-details';
import { getDbClient } from '@/lib/db';
import { getCronMetadata } from '@/lib/cron/cron-metadata';

const querySchema = z.object({
  cadence: z.enum(['hourly', 'daily']).optional().default('hourly'),
});

function resolveCronSecret(request: NextRequest): string | null {
  const headerSecret = request.headers.get('x-skillbound-cron-secret');
  if (headerSecret) {
    return headerSecret;
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return null;
  }

  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length).trim();
  }

  return null;
}

function cadenceMs(cadence: 'hourly' | 'daily') {
  return cadence === 'hourly'
    ? 60 * 60 * 1000
    : 24 * 60 * 60 * 1000;
}

export async function GET(request: NextRequest) {
  const configuredSecret = process.env['CRON_SECRET']?.trim();
  const providedSecret = resolveCronSecret(request);

  if (configuredSecret && providedSecret !== configuredSecret) {
    const problem = createProblemDetails({
      status: 401,
      title: 'Unauthorized',
      detail: 'Missing or invalid cron secret.',
      instance: request.nextUrl.pathname,
    });

    return NextResponse.json(problem, { status: problem.status });
  }

  const parsed = querySchema.safeParse({
    cadence: request.nextUrl.searchParams.get('cadence') ?? undefined,
  });

  if (!parsed.success) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid request',
      detail: 'Invalid cadence.',
      errors: parsed.error.issues,
      instance: request.nextUrl.pathname,
    });

    return NextResponse.json(problem, { status: problem.status });
  }

  const cadence = parsed.data.cadence;
  const db = getDbClient();
  const cutoff = new Date(Date.now() - cadenceMs(cadence));

  const [totalResult] = await db
    .select({ totalCharacters: sql<number>`count(*)` })
    .from(characterProfiles);
  const totalCharacters = totalResult?.totalCharacters ?? 0;

  const [dueResult] = await db
    .select({ dueCount: sql<number>`count(*)` })
    .from(characterProfiles)
    .where(
      or(
        isNull(characterProfiles.lastSyncedAt),
        lt(characterProfiles.lastSyncedAt, cutoff)
      )
    );
  const dueCount = dueResult?.dueCount ?? 0;

  const [latestSnapshot] = await db
    .select({
      capturedAt: characterSnapshots.capturedAt,
      profileId: characterSnapshots.profileId,
    })
    .from(characterSnapshots)
    .orderBy(desc(characterSnapshots.capturedAt))
    .limit(1);

  const lastRun = await getCronMetadata<{
    ranAt?: string;
    wom?: { attempted: number; inserted: number };
  }>(`snapshots:${cadence}`);

  const nextCronAt = lastRun?.ranAt
    ? new Date(new Date(lastRun.ranAt).getTime() + cadenceMs(cadence)).toISOString()
    : new Date(Date.now() + cadenceMs(cadence)).toISOString();

  return NextResponse.json({
    cadence,
    cutoff,
    totalCharacters: Number(totalCharacters ?? 0),
    dueCount: Number(dueCount ?? 0),
    latestSnapshot,
    lastRun,
    nextCronAt,
  });
}
