import { asc, characterProfiles, isNull, lt, or } from '@skillbound/database';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { syncCharacter } from '@/lib/character/character-sync';
import { acquireCronLock, releaseCronLock } from '@/lib/cron/cron-lock';
import { setCronMetadata } from '@/lib/cron/cron-metadata';
import { getDbClient } from '@/lib/db';
import { logger } from '@/lib/logging/logger';
import { createProblemDetails } from '@/lib/api/problem-details';

const querySchema = z.object({
  cadence: z.enum(['hourly', 'daily']).optional().default('hourly'),
  limit: z
    .string()
    .optional()
    .transform((value) => (value ? Number(value) : 25))
    .refine((value) => Number.isFinite(value) && value > 0, {
      message: 'limit must be a positive number',
    }),
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

function resolveCutoff(cadence: 'hourly' | 'daily'): Date {
  const now = Date.now();
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;
  return new Date(now - (cadence === 'hourly' ? hour : day));
}

export async function POST(request: NextRequest) {
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
    limit: request.nextUrl.searchParams.get('limit') ?? undefined,
  });

  if (!parsed.success) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid request',
      detail: 'Invalid cadence or limit.',
      errors: parsed.error.issues,
      instance: request.nextUrl.pathname,
    });

    return NextResponse.json(problem, { status: problem.status });
  }

  const { cadence, limit } = parsed.data;
  const lockTtlMsRaw = process.env['CRON_LOCK_TTL_MS'];
  const lockTtlMs = Number.isFinite(Number(lockTtlMsRaw))
    ? Number(lockTtlMsRaw)
    : 5 * 60 * 1000;
  const lockKey = `characters-snapshots:${cadence}`;
  const lockAcquired = await acquireCronLock(lockKey, lockTtlMs);

  if (!lockAcquired) {
    const problem = createProblemDetails({
      status: 429,
      title: 'Job already running',
      detail: 'A sync job is already running for this cadence.',
      instance: request.nextUrl.pathname,
    });

    return NextResponse.json(problem, { status: problem.status });
  }

  const cutoff = resolveCutoff(cadence);
  const db = getDbClient();

  try {
    const targets = await db
      .select()
      .from(characterProfiles)
      .where(
        or(
          isNull(characterProfiles.lastSyncedAt),
          lt(characterProfiles.lastSyncedAt, cutoff)
        )
      )
      .orderBy(asc(characterProfiles.lastSyncedAt))
      .limit(limit);

    const results = [];

    for (const character of targets) {
      try {
        const syncResult = await syncCharacter(db, character);

        results.push({
          characterId: character.id,
          displayName: character.displayName,
          syncedAt: syncResult.capturedAt,
        });
      } catch (error) {
        logger.error({ err: error, characterId: character.id }, 'Sync failure');
        results.push({
          characterId: character.id,
          displayName: character.displayName,
          error: error instanceof Error ? error.message : 'Sync failed',
        });
      }
    }

    const responsePayload = {
      cadence,
      cutoff,
      count: results.length,
      results,
      ranAt: new Date().toISOString(),
    };

    await setCronMetadata(`snapshots:${cadence}`, responsePayload);

    return NextResponse.json(responsePayload);
  } finally {
    await releaseCronLock(lockKey);
  }
}
