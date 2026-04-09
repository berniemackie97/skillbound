/**
 * GET /api/ge/investments
 *
 * Returns investment opportunities — items where historical data suggests
 * a price rebound, seasonal rise, or trend reversal is likely.
 * These are "buy and hold" recommendations, not quick flips.
 */

import { NextResponse } from 'next/server';

import { logger } from '@/lib/logging/logger';
import { getGeExchangeItems } from '@/lib/trading/ge-service';
import {
  scanForOpportunities,
  type InvestmentOpportunity,
} from '@/lib/trading/investment-opportunities';
import { getItemDailySummaries } from '@/lib/trading/market-history';

export const dynamic = 'force-dynamic';

// Cache investments for 30 minutes since analysis is expensive
let cachedResult: {
  opportunities: InvestmentOpportunity[];
  itemsScanned: number;
  itemsWithData: number;
  cachedAt: number;
} | null = null;

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

export async function GET() {
  try {
    // Return cache if fresh
    if (cachedResult && Date.now() - cachedResult.cachedAt < CACHE_TTL_MS) {
      return NextResponse.json({
        data: cachedResult.opportunities,
        meta: {
          itemsScanned: cachedResult.itemsScanned,
          itemsWithData: cachedResult.itemsWithData,
          opportunityCount: cachedResult.opportunities.length,
          cached: true,
          cachedAt: new Date(cachedResult.cachedAt).toISOString(),
        },
      });
    }

    // Get all tradeable items with current prices
    const items = await getGeExchangeItems();

    // Only analyze items with positive margin and reasonable volume
    const candidates = items.filter(
      (item) =>
        item.buyPrice !== null &&
        item.buyPrice > 100 && // Skip very cheap items
        (item.volume1h ?? 0) > 0 // Must have some activity
    );

    // Limit to top 200 items by volume to keep response time reasonable
    const topByVolume = candidates
      .sort((a, b) => (b.volume1h ?? 0) - (a.volume1h ?? 0))
      .slice(0, 200);

    // Fetch full year of historical summaries for comprehensive analysis
    // (seasonality, long-term trends, technical indicators need months of data)
    const oneYearAgo = new Date();
    oneYearAgo.setUTCDate(oneYearAgo.getUTCDate() - 365);

    const itemsWithHistory = await Promise.all(
      topByVolume.map(async (item) => {
        const summaries = await getItemDailySummaries(item.id, oneYearAgo);
        return {
          itemId: item.id,
          itemName: item.name,
          currentPrice: item.buyPrice,
          summaries,
        };
      })
    );

    const result = scanForOpportunities(itemsWithHistory);

    // Update cache
    cachedResult = {
      ...result,
      cachedAt: Date.now(),
    };

    logger.info(
      {
        itemsScanned: result.itemsScanned,
        itemsWithData: result.itemsWithData,
        opportunityCount: result.opportunities.length,
      },
      'Investment opportunity scan completed'
    );

    return NextResponse.json({
      data: result.opportunities,
      meta: {
        itemsScanned: result.itemsScanned,
        itemsWithData: result.itemsWithData,
        opportunityCount: result.opportunities.length,
        cached: false,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to scan for investment opportunities');
    return NextResponse.json(
      { error: 'Failed to scan for investment opportunities' },
      { status: 500 }
    );
  }
}
