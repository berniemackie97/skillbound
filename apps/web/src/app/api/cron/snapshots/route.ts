import { characterProfiles } from '@skillbound/database';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createProblemDetails } from '@/lib/api/problem-details';
import { syncCharacter } from '@/lib/character/character-sync';
import { getDbClient } from '@/lib/db';
import {
  captureSnapshots,
  planSnapshotCapture,
  summarizeSnapshotCapture,
} from '@/lib/snapshots/snapshot-capture';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  minAgeHours: z.coerce.number().int().min(0).max(720).optional(),
  limit: z.coerce.number().int().min(1).max(250).optional(),
  delayMs: z.coerce.number().int().min(0).max(5000).optional(),
  dryRun: z.string().optional(),
});

function parseBooleanParam(value: string | null): boolean | null {
  if (value === null) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'y'].includes(normalized)) {
    return true;
  }
  if (['false', '0', 'no', 'n'].includes(normalized)) {
    return false;
  }
  return null;
}

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

  const parsedQuery = querySchema.safeParse({
    minAgeHours: request.nextUrl.searchParams.get('minAgeHours') ?? undefined,
    limit: request.nextUrl.searchParams.get('limit') ?? undefined,
    delayMs: request.nextUrl.searchParams.get('delayMs') ?? undefined,
    dryRun: request.nextUrl.searchParams.get('dryRun') ?? undefined,
  });

  if (!parsedQuery.success) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid parameters',
      detail: 'minAgeHours, limit, and delayMs must be valid numbers.',
      errors: parsedQuery.error.issues,
      instance: request.nextUrl.pathname,
    });

    return NextResponse.json(problem, { status: problem.status });
  }

  const dryRunValue = parseBooleanParam(parsedQuery.data.dryRun ?? null);
  if (parsedQuery.data.dryRun && dryRunValue === null) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid dryRun flag',
      detail: 'dryRun must be true or false.',
      instance: request.nextUrl.pathname,
    });

    return NextResponse.json(problem, { status: problem.status });
  }

  const minAgeHours = parsedQuery.data.minAgeHours ?? 24;
  const limit = parsedQuery.data.limit ?? 50;
  const delayMs = parsedQuery.data.delayMs ?? 250;
  const dryRun = dryRunValue ?? false;

  const db = getDbClient();
  const allCharacters = await db.select().from(characterProfiles);

  const now = new Date();
  const minAgeMs = minAgeHours * 60 * 60 * 1000;
  const plan = planSnapshotCapture(allCharacters, now, minAgeMs, limit);

  if (dryRun) {
    return NextResponse.json({
      data: {
        dryRun: true,
        attempted: 0,
        captured: 0,
        failed: 0,
        skipped: plan.skipped.length,
        candidates: plan.candidates.map((candidate) => ({
          characterId: candidate.id,
          displayName: candidate.displayName,
          lastSyncedAt: candidate.lastSyncedAt,
        })),
        skippedDetails: plan.skipped,
      },
      meta: {
        minAgeHours,
        limit,
        delayMs,
        totalCharacters: allCharacters.length,
      },
    });
  }

  const startedAt = Date.now();
  const results = await captureSnapshots(
    plan.candidates,
    async (character) => {
      const { snapshot, capturedAt } = await syncCharacter(db, character);
      return { snapshotId: snapshot.id, capturedAt };
    },
    { delayMs }
  );

  const summary = summarizeSnapshotCapture(results, plan.skipped);

  return NextResponse.json({
    data: summary,
    meta: {
      minAgeHours,
      limit,
      delayMs,
      totalCharacters: allCharacters.length,
      durationMs: Date.now() - startedAt,
    },
  });
}
