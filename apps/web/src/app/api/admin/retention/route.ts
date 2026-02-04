import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createProblemDetails } from '@/lib/api/problem-details';
import {
  getGlobalRetentionStats,
  runRetentionJob,
} from '@/lib/snapshots/snapshot-retention';

const querySchema = z.object({
  batchSize: z.coerce.number().int().min(1).max(5000).optional(),
  dryRun: z.string().optional(),
  characterIds: z.string().optional(),
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

function parseCharacterIds(value: string | null): string[] | undefined {
  if (!value) {
    return undefined;
  }

  const ids = value
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0);

  if (ids.length === 0) {
    return undefined;
  }

  // Validate UUIDs
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const validIds = ids.filter((id) => uuidRegex.test(id));

  return validIds.length > 0 ? validIds : undefined;
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

/**
 * GET /api/admin/retention
 *
 * Get global retention statistics
 */
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

  try {
    const stats = await getGlobalRetentionStats();

    return NextResponse.json({
      data: stats,
      meta: {
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    const problem = createProblemDetails({
      status: 500,
      title: 'Failed to get retention stats',
      detail: errorMessage,
      instance: request.nextUrl.pathname,
    });

    return NextResponse.json(problem, { status: problem.status });
  }
}

/**
 * POST /api/admin/retention
 *
 * Run the snapshot retention job
 *
 * Query parameters:
 * - batchSize: Maximum snapshots to process per tier (default: 1000, max: 5000)
 * - dryRun: If true, simulate without modifying data
 * - characterIds: Comma-separated list of character UUIDs to process (optional)
 */
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

  const parsedQuery = querySchema.safeParse({
    batchSize: request.nextUrl.searchParams.get('batchSize') ?? undefined,
    dryRun: request.nextUrl.searchParams.get('dryRun') ?? undefined,
    characterIds: request.nextUrl.searchParams.get('characterIds') ?? undefined,
  });

  if (!parsedQuery.success) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid parameters',
      detail: 'batchSize must be a valid number between 1 and 5000.',
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

  const batchSize = parsedQuery.data.batchSize ?? 1000;
  const dryRun = dryRunValue ?? false;
  const profileIds = parseCharacterIds(parsedQuery.data.characterIds ?? null);

  try {
    const result = await runRetentionJob({
      batchSize,
      dryRun,
      profileIds,
    });

    return NextResponse.json({
      data: result,
      meta: {
        parameters: {
          batchSize,
          dryRun,
          characterIds: profileIds ?? null,
        },
      },
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    const problem = createProblemDetails({
      status: 500,
      title: 'Retention job failed',
      detail: errorMessage,
      instance: request.nextUrl.pathname,
    });

    return NextResponse.json(problem, { status: problem.status });
  }
}
