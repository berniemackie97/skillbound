/**
 * GET /api/ge/items/:id/analysis
 *
 * Returns historical market analysis for a single item, including
 * price trends, seasonal patterns, support/resistance levels, and
 * actionable insights based on our persisted market history data.
 */

import { NextResponse } from 'next/server';

import { estimateFlipCycleTime } from '@/lib/trading/fill-time';
import { getGeItem } from '@/lib/trading/ge-service';
import { ITEM_SETS } from '@/lib/trading/item-sets';
import { analyzeItemMarket } from '@/lib/trading/market-analysis';
import {
  getItemDailySummaries,
  getSnapshotCount,
} from '@/lib/trading/market-history';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const itemId = parseInt(id, 10);

  if (isNaN(itemId) || itemId <= 0) {
    return NextResponse.json({ error: 'Invalid item ID' }, { status: 400 });
  }

  try {
    // Get current market data for the item
    const currentItem = await getGeItem(itemId);

    // Get historical daily summaries (up to 1 year back)
    const oneYearAgo = new Date();
    oneYearAgo.setUTCFullYear(oneYearAgo.getUTCFullYear() - 1);

    const [summaries, snapshotCount] = await Promise.all([
      getItemDailySummaries(itemId, oneYearAgo),
      getSnapshotCount(itemId),
    ]);

    if (summaries.length === 0) {
      return NextResponse.json({
        data: null,
        meta: {
          itemId,
          itemName: currentItem?.name ?? null,
          snapshotCount,
          message:
            'No historical data available yet. Data is captured every 6 hours — check back later.',
        },
      });
    }

    const analysis = analyzeItemMarket(
      itemId,
      summaries,
      currentItem?.buyPrice ?? null
    );

    // Fill-time estimation for this item
    let fillTimeEstimate = null;
    if (currentItem) {
      const hourlyVolume =
        currentItem.volume1h ??
        (currentItem.volume5m !== null ? currentItem.volume5m * 12 : null);
      const qty = currentItem.buyLimit ?? 1;
      const cycle = estimateFlipCycleTime(
        qty,
        currentItem.buyLimit,
        hourlyVolume
      );
      fillTimeEstimate = {
        quantity: qty,
        ...cycle,
      };
    }

    // Check if this item belongs to any known set
    const setMemberships = ITEM_SETS.filter(
      (set) =>
        set.setId === itemId || set.components.some((c) => c.itemId === itemId)
    ).map((set) => ({ setId: set.setId, setName: set.setName }));

    return NextResponse.json({
      data: {
        ...analysis,
        itemName: currentItem?.name ?? null,
        alchFloor: currentItem?.alchFloor ?? null,
        distanceFromAlchFloor: currentItem?.distanceFromAlchFloor ?? null,
        fillTimeEstimate,
        setMemberships,
      },
      meta: {
        itemId,
        snapshotCount,
        dailySummaryCount: summaries.length,
      },
    });
  } catch (error) {
    console.error('Market analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to generate market analysis' },
      { status: 500 }
    );
  }
}
