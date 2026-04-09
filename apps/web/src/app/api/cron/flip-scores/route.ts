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

import type { GeDailySummary } from '@skillbound/database';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createProblemDetails } from '@/lib/api/problem-details';
import { logger } from '@/lib/logging/logger';
import {
  calculateFlipQualityScore,
  type HistoricalContext,
} from '@/lib/trading/flip-scoring';
import {
  bulkUpsertFlipSuggestions,
  pruneStaleFlipSuggestions,
  type FlipSuggestionInput,
} from '@/lib/trading/flip-suggestions';
import {
  getGeExchangeItems,
  type GeExchangeItem,
} from '@/lib/trading/ge-service';
import { computeTechnicalIndicators } from '@/lib/trading/market-analysis';
import { getItemDailySummaries } from '@/lib/trading/market-history';

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
 * Compute multi-timeframe HistoricalContext from daily summaries.
 *
 * Accepts up to 365 days of data and produces:
 * - 30d / 90d / 365d price averages and volatility
 * - RSI, Bollinger Bands, MACD, 200-day SMA
 * - Volume averages across timeframes
 *
 * Returns undefined when there is no usable data.
 */
function computeHistoricalContext(
  summaries: GeDailySummary[],
  currentPrice: number | null
): HistoricalContext | undefined {
  if (summaries.length === 0) return undefined;

  // Sort by date ascending (oldest first) for indicator computation
  const sorted = [...summaries].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const now = Date.now();
  const msPerDay = 24 * 60 * 60 * 1000;

  // Split into time windows
  const last30d = sorted.filter(
    (s) => now - new Date(s.date).getTime() <= 30 * msPerDay
  );
  const last90d = sorted.filter(
    (s) => now - new Date(s.date).getTime() <= 90 * msPerDay
  );

  // Extract price/volume arrays per window
  const extractPrices = (arr: GeDailySummary[]) =>
    arr.map((s) => s.avgBuyPrice).filter((p): p is number => p !== null);
  const extractVolumes = (arr: GeDailySummary[]) =>
    arr.map((s) => s.totalVolume).filter((v): v is number => v !== null);

  const prices30d = extractPrices(last30d);
  const prices90d = extractPrices(last90d);
  const pricesAll = extractPrices(sorted);
  const volumes30d = extractVolumes(last30d);
  const volumes90d = extractVolumes(last90d);

  const avg = (arr: number[]) =>
    arr.length > 0
      ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length)
      : null;

  const coeffVar = (arr: number[], mean: number | null) => {
    if (mean === null || mean <= 0 || arr.length < 3) return null;
    const variance =
      arr.reduce((sum, p) => sum + (p - mean) ** 2, 0) / arr.length;
    return Math.round((Math.sqrt(variance) / mean) * 100 * 100) / 100;
  };

  const avgPrice30d = avg(prices30d);
  const avgPrice90d = avg(prices90d);
  const avgPrice365d = avg(pricesAll);
  const avgVolume30d = avg(volumes30d);
  const avgVolume90d = avg(volumes90d);

  // Technical indicators from the full price series
  const indicators = computeTechnicalIndicators(pricesAll);

  // Bollinger Band position
  const bollingerFields: Pick<
    HistoricalContext,
    'belowBollingerLower' | 'aboveBollingerUpper'
  > = {};
  if (indicators.bollingerBands && currentPrice !== null) {
    bollingerFields.belowBollingerLower =
      currentPrice < indicators.bollingerBands.lower;
    bollingerFields.aboveBollingerUpper =
      currentPrice > indicators.bollingerBands.upper;
  }

  // Price vs 200d SMA
  let priceVsSma200d: number | null = null;
  if (
    indicators.sma200d !== null &&
    indicators.sma200d > 0 &&
    currentPrice !== null
  ) {
    priceVsSma200d =
      Math.round(
        ((currentPrice - indicators.sma200d) / indicators.sma200d) * 1000
      ) / 10;
  }

  return {
    avgPrice30d,
    avgVolume30d,
    volatility30d: coeffVar(prices30d, avgPrice30d),
    dataPoints: sorted.length,

    // Extended timeframes
    avgPrice90d,
    volatility90d: coeffVar(prices90d, avgPrice90d),
    avgPrice365d,
    volatility365d: coeffVar(pricesAll, avgPrice365d),
    avgVolume90d,

    // Technical indicators
    rsi14d: indicators.rsi14d,
    ...bollingerFields,
    macdSignal: indicators.macd?.crossover ?? 0,
    priceVsSma200d,
  };
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

    // Pre-filter to items worth re-scoring (positive margin + existing quality)
    const scoreable = items.filter(
      (item) =>
        item.margin !== null &&
        item.margin > 0 &&
        item.buyPrice !== null &&
        item.sellPrice !== null
    );

    // Enrich with historical context and re-score in batches
    // Fetch up to 365 days for full multi-timeframe analysis (RSI, MACD, Bollinger, seasonality)
    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const batchSize = 50;
    let historicalHits = 0;

    for (let i = 0; i < scoreable.length; i += batchSize) {
      const batch = scoreable.slice(i, i + batchSize);

      const summariesBatch = await Promise.all(
        batch.map((item) => getItemDailySummaries(item.id, oneYearAgo))
      );

      for (let j = 0; j < batch.length; j++) {
        const item = batch[j]!;
        const summaries = summariesBatch[j]!;
        const historicalContext = computeHistoricalContext(
          summaries,
          item.buyPrice
        );

        if (historicalContext) {
          historicalHits++;
          // Re-score with historical context
          item.flipQuality = calculateFlipQualityScore({
            buyPrice: item.buyPrice,
            sellPrice: item.sellPrice,
            buyPriceTime: item.buyPriceTime,
            sellPriceTime: item.sellPriceTime,
            margin: item.margin,
            tax: item.tax,
            avgHighPrice5m: item.avgHighPrice5m,
            avgLowPrice5m: item.avgLowPrice5m,
            volume5m: item.volume5m,
            highPriceVolume5m: item.highPriceVolume5m,
            lowPriceVolume5m: item.lowPriceVolume5m,
            avgHighPrice1h: item.avgHighPrice1h,
            avgLowPrice1h: item.avgLowPrice1h,
            volume1h: item.volume1h,
            highPriceVolume1h: item.highPriceVolume1h,
            lowPriceVolume1h: item.lowPriceVolume1h,
            buyLimit: item.buyLimit,
            alchFloor: item.alchFloor,
            historicalContext,
          });
        }
      }
    }

    logger.info(
      { scoreable: scoreable.length, historicalHits },
      'Historical context enrichment complete'
    );

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
    const { upserted, errors } = await bulkUpsertFlipSuggestions(candidates);

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
      detail: error instanceof Error ? error.message : 'Unknown error occurred',
      instance: request.nextUrl.pathname,
    });
    return NextResponse.json(problem, { status: problem.status });
  }
}
