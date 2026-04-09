/**
 * Cron: Price Alert Checks
 *
 * Checks all active watch items against current market prices and
 * generates alerts when thresholds are met. Alerts are persisted
 * to the geAlerts table for UI display.
 *
 * Schedule: Every 15 minutes (configured externally)
 * Auth: CRON_SECRET header
 */

import { eq, geWatchItems } from '@skillbound/database';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { createProblemDetails } from '@/lib/api/problem-details';
import { getDbClient } from '@/lib/db';
import { logger } from '@/lib/logging/logger';
import {
  checkAlertsForCharacter,
  pruneOldAlerts,
  saveAlerts,
} from '@/lib/trading/alerts';
import {
  getGeExchangeItems,
  type GeExchangeItem,
} from '@/lib/trading/ge-service';

export const dynamic = 'force-dynamic';

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
    // Get all current market prices
    const items = await getGeExchangeItems();
    const itemMap = new Map<number, GeExchangeItem>();
    for (const item of items) {
      itemMap.set(item.id, item);
    }

    // Find all distinct character IDs with active watch items
    const db = getDbClient();
    const activeWatchers = await db
      .selectDistinct({ userCharacterId: geWatchItems.userCharacterId })
      .from(geWatchItems)
      .where(eq(geWatchItems.isActive, true));

    let totalAlerts = 0;
    let characterCount = 0;

    for (const { userCharacterId } of activeWatchers) {
      const alerts = await checkAlertsForCharacter(userCharacterId, itemMap);

      if (alerts.length > 0) {
        const saved = await saveAlerts(alerts);
        totalAlerts += saved;
        characterCount++;
      }
    }

    // Prune old read alerts (30 days)
    const pruned = await pruneOldAlerts();

    logger.info(
      {
        watchersChecked: activeWatchers.length,
        alertsGenerated: totalAlerts,
        characterCount,
        pruned,
        durationMs: Date.now() - startedAt,
      },
      'Alert check cron completed'
    );

    return NextResponse.json({
      data: {
        watchersChecked: activeWatchers.length,
        alertsGenerated: totalAlerts,
        charactersAlerted: characterCount,
        pruned,
      },
      meta: {
        durationMs: Date.now() - startedAt,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Alert check cron failed');

    const problem = createProblemDetails({
      status: 500,
      title: 'Cron job failed',
      detail: error instanceof Error ? error.message : 'Unknown error occurred',
      instance: request.nextUrl.pathname,
    });
    return NextResponse.json(problem, { status: problem.status });
  }
}
