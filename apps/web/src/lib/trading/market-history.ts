/**
 * Market History Service
 *
 * Persists periodic market snapshots and aggregates daily summaries.
 * Used by the market-history cron to build a long-term data warehouse
 * that powers trend analysis, seasonality detection, and predictions.
 */

import {
  and,
  desc,
  eq,
  geDailySummary,
  gePriceHistory,
  gte,
  lte,
  sql,
  type GeDailySummary,
  type GePriceHistory,
  type NewGeDailySummary,
  type NewGePriceHistory,
} from '@skillbound/database';

import { getDbClient } from '../db';
import { logger } from '../logging/logger';

import type { GeExchangeItem } from './ge-service';

// ---------------------------------------------------------------------------
// Snapshot persistence
// ---------------------------------------------------------------------------

export interface MarketSnapshotInput {
  itemId: number;
  buyPrice: number | null;
  sellPrice: number | null;
  margin: number | null;
  avgHighPrice5m: number | null;
  avgLowPrice5m: number | null;
  volume5m: number | null;
  highPriceVolume5m: number | null;
  lowPriceVolume5m: number | null;
  avgHighPrice1h: number | null;
  avgLowPrice1h: number | null;
  volume1h: number | null;
  highPriceVolume1h: number | null;
  lowPriceVolume1h: number | null;
  buyLimit: number | null;
}

/**
 * Convert a GeExchangeItem to a snapshot input.
 */
export function itemToSnapshot(item: GeExchangeItem): MarketSnapshotInput {
  return {
    itemId: item.id,
    buyPrice: item.buyPrice,
    sellPrice: item.sellPrice,
    margin: item.margin,
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
  };
}

/**
 * Bulk insert market snapshots. Processes in batches to avoid overwhelming DB.
 * Skips duplicates (same item + capturedAt) via ON CONFLICT DO NOTHING.
 */
export async function bulkInsertSnapshots(
  snapshots: MarketSnapshotInput[],
  capturedAt: Date = new Date()
): Promise<{ inserted: number; errors: number }> {
  const db = getDbClient();
  let inserted = 0;
  let errors = 0;

  const batchSize = 100;
  for (let i = 0; i < snapshots.length; i += batchSize) {
    const batch = snapshots.slice(i, i + batchSize);

    const values: NewGePriceHistory[] = batch.map((s) => ({
      itemId: s.itemId,
      capturedAt,
      buyPrice: s.buyPrice,
      sellPrice: s.sellPrice,
      margin: s.margin,
      avgHighPrice5m: s.avgHighPrice5m,
      avgLowPrice5m: s.avgLowPrice5m,
      volume5m: s.volume5m,
      highPriceVolume5m: s.highPriceVolume5m,
      lowPriceVolume5m: s.lowPriceVolume5m,
      avgHighPrice1h: s.avgHighPrice1h,
      avgLowPrice1h: s.avgLowPrice1h,
      volume1h: s.volume1h,
      highPriceVolume1h: s.highPriceVolume1h,
      lowPriceVolume1h: s.lowPriceVolume1h,
      buyLimit: s.buyLimit,
    }));

    try {
      await db
        .insert(gePriceHistory)
        .values(values)
        .onConflictDoNothing({
          target: [gePriceHistory.itemId, gePriceHistory.capturedAt],
        });
      inserted += batch.length;
    } catch (error) {
      errors += batch.length;
      logger.error(
        { error, batchStart: i, batchSize: batch.length },
        'Failed to insert market history batch'
      );
    }
  }

  return { inserted, errors };
}

// ---------------------------------------------------------------------------
// Querying snapshots
// ---------------------------------------------------------------------------

/**
 * Get raw price history for an item within a date range.
 */
export async function getItemPriceHistory(
  itemId: number,
  startDate: Date,
  endDate: Date = new Date()
): Promise<GePriceHistory[]> {
  const db = getDbClient();

  return db
    .select()
    .from(gePriceHistory)
    .where(
      and(
        eq(gePriceHistory.itemId, itemId),
        gte(gePriceHistory.capturedAt, startDate),
        lte(gePriceHistory.capturedAt, endDate)
      )
    )
    .orderBy(gePriceHistory.capturedAt);
}

/**
 * Get the most recent snapshot for an item.
 */
export async function getLatestSnapshot(
  itemId: number
): Promise<GePriceHistory | null> {
  const db = getDbClient();

  const [row] = await db
    .select()
    .from(gePriceHistory)
    .where(eq(gePriceHistory.itemId, itemId))
    .orderBy(desc(gePriceHistory.capturedAt))
    .limit(1);

  return row ?? null;
}

/**
 * Count how many snapshots exist for an item.
 */
export async function getSnapshotCount(itemId: number): Promise<number> {
  const db = getDbClient();

  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(gePriceHistory)
    .where(eq(gePriceHistory.itemId, itemId));

  return result?.count ?? 0;
}

// ---------------------------------------------------------------------------
// Daily summary aggregation
// ---------------------------------------------------------------------------

/**
 * Compute and upsert a daily summary for one item on a given day.
 * Called by the cron after inserting raw snapshots.
 */
export async function aggregateDailySummary(
  itemId: number,
  date: Date
): Promise<void> {
  const db = getDbClient();

  // Get all snapshots for this item on this day
  const dayStart = new Date(date);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  const snapshots = await db
    .select()
    .from(gePriceHistory)
    .where(
      and(
        eq(gePriceHistory.itemId, itemId),
        gte(gePriceHistory.capturedAt, dayStart),
        lte(gePriceHistory.capturedAt, dayEnd)
      )
    );

  if (snapshots.length === 0) return;

  // Aggregate
  const buyPrices = snapshots
    .map((s) => s.buyPrice)
    .filter((p): p is number => p !== null);
  const sellPrices = snapshots
    .map((s) => s.sellPrice)
    .filter((p): p is number => p !== null);
  const margins = snapshots
    .map((s) => s.margin)
    .filter((m): m is number => m !== null);
  const volumes = snapshots
    .map((s) => s.volume1h)
    .filter((v): v is number => v !== null);

  const avg = (arr: number[]) =>
    arr.length > 0
      ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length)
      : null;

  const avgBuyPrice = avg(buyPrices);
  const avgSellPrice = avg(sellPrices);
  const avgMargin = avg(margins);
  const avgMarginPercent =
    avgMargin !== null && avgSellPrice !== null && avgSellPrice > 0
      ? (avgMargin / avgSellPrice) * 100
      : null;

  const summary: NewGeDailySummary = {
    itemId,
    date: dayStart,
    avgBuyPrice,
    avgSellPrice,
    highBuyPrice: buyPrices.length > 0 ? Math.max(...buyPrices) : null,
    lowBuyPrice: buyPrices.length > 0 ? Math.min(...buyPrices) : null,
    highSellPrice: sellPrices.length > 0 ? Math.max(...sellPrices) : null,
    lowSellPrice: sellPrices.length > 0 ? Math.min(...sellPrices) : null,
    totalVolume: volumes.length > 0 ? volumes.reduce((a, b) => a + b, 0) : null,
    avgMargin,
    avgMarginPercent,
    snapshotCount: snapshots.length,
  };

  await db
    .insert(geDailySummary)
    .values(summary)
    .onConflictDoUpdate({
      target: [geDailySummary.itemId, geDailySummary.date],
      set: {
        avgBuyPrice: sql`excluded.avg_buy_price`,
        avgSellPrice: sql`excluded.avg_sell_price`,
        highBuyPrice: sql`excluded.high_buy_price`,
        lowBuyPrice: sql`excluded.low_buy_price`,
        highSellPrice: sql`excluded.high_sell_price`,
        lowSellPrice: sql`excluded.low_sell_price`,
        totalVolume: sql`excluded.total_volume`,
        avgMargin: sql`excluded.avg_margin`,
        avgMarginPercent: sql`excluded.avg_margin_percent`,
        snapshotCount: sql`excluded.snapshot_count`,
      },
    });
}

/**
 * Batch aggregate daily summaries for all items that had snapshots today.
 */
export async function aggregateAllDailySummaries(
  date: Date = new Date()
): Promise<number> {
  const db = getDbClient();

  const dayStart = new Date(date);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  // Get distinct items that had snapshots today
  const items = await db
    .selectDistinct({ itemId: gePriceHistory.itemId })
    .from(gePriceHistory)
    .where(
      and(
        gte(gePriceHistory.capturedAt, dayStart),
        lte(gePriceHistory.capturedAt, dayEnd)
      )
    );

  for (const { itemId } of items) {
    try {
      await aggregateDailySummary(itemId, date);
    } catch (error) {
      logger.error(
        { error, itemId },
        'Failed to aggregate daily summary for item'
      );
    }
  }

  return items.length;
}

// ---------------------------------------------------------------------------
// Daily summary queries
// ---------------------------------------------------------------------------

/**
 * Get daily summaries for an item over a date range.
 */
export async function getItemDailySummaries(
  itemId: number,
  startDate: Date,
  endDate: Date = new Date()
): Promise<GeDailySummary[]> {
  const db = getDbClient();

  return db
    .select()
    .from(geDailySummary)
    .where(
      and(
        eq(geDailySummary.itemId, itemId),
        gte(geDailySummary.date, startDate),
        lte(geDailySummary.date, endDate)
      )
    )
    .orderBy(geDailySummary.date);
}

// ---------------------------------------------------------------------------
// Retention
// ---------------------------------------------------------------------------

/**
 * Prune raw snapshots older than the given age.
 * Daily summaries are kept forever (they're tiny).
 */
export async function pruneOldSnapshots(maxAgeMs: number): Promise<number> {
  const db = getDbClient();
  const cutoff = new Date(Date.now() - maxAgeMs);

  const deleted = await db
    .delete(gePriceHistory)
    .where(sql`${gePriceHistory.capturedAt} < ${cutoff}`)
    .returning({ id: gePriceHistory.id });

  return deleted.length;
}
