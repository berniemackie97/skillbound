/**
 * Cron: Flip Score Snapshots
 *
 * Periodically fetches all GE items, computes flip quality scores,
 * and persists the top candidates to geFlipSuggestions for analytics
 * and the "Find Me a Flip" feature.
 *
 * Schedule: Every 12 hours (configured externally via Vercel Cron or similar)
 * Auth: CRON_SECRET header
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createProblemDetails } from '@/lib/api/problem-details';
import { logger } from '@/lib/logging/logger';
import {
  bulkUpsertFlipSuggestions,
  pruneStaleFlipSuggestions,
  type FlipSuggestionInput,
} from '@/lib/trading/flip-suggestions';
import {
  getGeExchangeItems,
  type GeExchangeItem,
} from '@/lib/trading/ge-service';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).optional(),
  minMargin: z.coerce.number().int().min(0).optional(),
  dryRun: z.string().optional(),
});

function parseBooleanParam(value: string | null): boolean | null {
  if (value === null) return null;
  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n'].includes(normalized)) return false;
  return null;
}

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

/**
 * Derive profit potential from margin percent.
 */
function deriveProfitPotential(
  marginPercent: number
): 'high' | 'medium' | 'low' {
  if (marginPercent >= 5) return 'high';
  if (marginPercent >= 2) return 'medium';
  return 'low';
}

/**
 * Convert a GeExchangeItem to a FlipSuggestionInput for DB storage.
 */
function itemToSuggestion(item: GeExchangeItem): FlipSuggestionInput | null {
  if (
    item.buyPrice === null ||
    item.sellPrice === null ||
    item.margin === null ||
    item.margin <= 0 ||
    item.flipQuality === null
  ) {
    return null;
  }

  const marginPercent =
    item.sellPrice > 0 ? (item.margin / item.sellPrice) * 100 : 0;

  return {
    itemId: item.id,
    itemName: item.name,
    currentMargin: item.margin,
    marginPercent,
    buyPrice: item.buyPrice,
    sellPrice: item.sellPrice,
    dailyVolume: item.volume1h ? item.volume1h * 24 : null,
    profitPotential: deriveProfitPotential(marginPercent),
    flipQuality: item.flipQuality,
  };
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
    limit: request.nextUrl.searchParams.get('limit') ?? undefined,
    minMargin: request.nextUrl.searchParams.get('minMargin') ?? undefined,
    dryRun: request.nextUrl.searchParams.get('dryRun') ?? undefined,
  });

  if (!parsedQuery.success) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid parameters',
      detail: 'limit and minMargin must be valid numbers.',
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

  const limit = parsedQuery.data.limit ?? 500;
  const minMargin = parsedQuery.data.minMargin ?? 1;
  const dryRun = dryRunValue ?? false;

  const startedAt = Date.now();

  try {
    // Fetch all items with live quality scores
    const items = await getGeExchangeItems();

    // Filter to items with positive margin and quality scores
    const candidates = items
      .map(itemToSuggestion)
      .filter(
        (s): s is FlipSuggestionInput =>
          s !== null && s.currentMargin >= minMargin
      )
      .sort((a, b) => b.flipQuality.score - a.flipQuality.score)
      .slice(0, limit);

    if (dryRun) {
      return NextResponse.json({
        data: {
          dryRun: true,
          totalItems: items.length,
          candidateCount: candidates.length,
          topCandidates: candidates.slice(0, 20).map((c) => ({
            itemId: c.itemId,
            itemName: c.itemName,
            margin: c.currentMargin,
            grade: c.flipQuality.grade,
            score: c.flipQuality.score,
            flags: c.flipQuality.flags,
          })),
        },
        meta: {
          limit,
          minMargin,
          durationMs: Date.now() - startedAt,
        },
      });
    }

    // Persist to database
    const { upserted, errors } =
      await bulkUpsertFlipSuggestions(candidates);

    // Prune suggestions older than 48 hours that weren't refreshed
    const pruned = await pruneStaleFlipSuggestions(48 * 60 * 60 * 1000);

    logger.info(
      {
        totalItems: items.length,
        candidates: candidates.length,
        upserted,
        errors,
        pruned,
        durationMs: Date.now() - startedAt,
      },
      'Flip score snapshot completed'
    );

    return NextResponse.json({
      data: {
        totalItems: items.length,
        candidateCount: candidates.length,
        upserted,
        errors,
        pruned,
      },
      meta: {
        limit,
        minMargin,
        durationMs: Date.now() - startedAt,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Flip score cron job failed');

    const problem = createProblemDetails({
      status: 500,
      title: 'Cron job failed',
      detail:
        error instanceof Error ? error.message : 'Unknown error occurred',
      instance: request.nextUrl.pathname,
    });
    return NextResponse.json(problem, { status: problem.status });
  }
}
