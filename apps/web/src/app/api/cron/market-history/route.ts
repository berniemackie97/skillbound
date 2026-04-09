/**
 * Cron: Market History Snapshots
 *
 * Captures a snapshot of every tradeable item's market state and persists
 * it to ge_price_history. Also refreshes daily summaries for today.
 *
 * Schedule: Every 6 hours (configured via Vercel Cron)
 * Auth: CRON_SECRET header
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { createProblemDetails } from '@/lib/api/problem-details';
import { logger } from '@/lib/logging/logger';
import { getGeExchangeItems } from '@/lib/trading/ge-service';
import {
  aggregateAllDailySummaries,
  bulkInsertSnapshots,
  itemToSnapshot,
  pruneOldSnapshots,
} from '@/lib/trading/market-history';

export const dynamic = 'force-dynamic';

// 180 days of raw snapshots (daily summaries kept forever)
const RAW_RETENTION_MS = 180 * 24 * 60 * 60 * 1000;

function resolveCronSecret(request: NextRequest): string | null {
  const headerSecret = request.headers.get('x-skillbound-cron-secret');
  if (headerSecret) return headerSecret;

  const authHeader = request.headers.get('authorization');
  if (!authHeader) return null;

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

  const startedAt = Date.now();

  try {
    // 1. Fetch all current market data
    const items = await getGeExchangeItems();

    // 2. Convert to snapshot inputs (all items, not just profitable ones)
    const capturedAt = new Date();
    const snapshots = items.map(itemToSnapshot);

    // 3. Persist raw snapshots
    const { inserted, errors } = await bulkInsertSnapshots(
      snapshots,
      capturedAt
    );

    // 4. Refresh daily summaries for today
    const summarized = await aggregateAllDailySummaries(capturedAt);

    // 5. Prune old raw snapshots (keep 180 days)
    const pruned = await pruneOldSnapshots(RAW_RETENTION_MS);

    logger.info(
      {
        totalItems: items.length,
        inserted,
        errors,
        summarized,
        pruned,
        durationMs: Date.now() - startedAt,
      },
      'Market history snapshot completed'
    );

    return NextResponse.json({
      data: {
        totalItems: items.length,
        snapshotsInserted: inserted,
        snapshotErrors: errors,
        dailySummariesUpdated: summarized,
        rawSnapshotsPruned: pruned,
      },
      meta: {
        capturedAt: capturedAt.toISOString(),
        durationMs: Date.now() - startedAt,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Market history cron job failed');

    const problem = createProblemDetails({
      status: 500,
      title: 'Cron job failed',
      detail: error instanceof Error ? error.message : 'Unknown error occurred',
      instance: request.nextUrl.pathname,
    });
    return NextResponse.json(problem, { status: problem.status });
  }
}
