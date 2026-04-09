import {
  bigint,
  index,
  integer,
  pgTable,
  real,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * GE Price History — periodic snapshots of every tradeable item's market state.
 *
 * Captured every 6 hours by the market-history cron. Each row stores the
 * instant prices, interval averages, and volume breakdowns at that moment.
 * This gives us weeks/months of data per item for trend analysis, seasonality
 * detection, and pattern recognition.
 *
 * Retention: raw rows kept forever (they're small — ~120 bytes each).
 * A single cron run with 4000 items × 120 bytes ≈ 480 KB. Four runs per day
 * ≈ 1.9 MB/day, ~700 MB/year — very manageable.
 */
export const gePriceHistory = pgTable(
  'ge_price_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    itemId: integer('item_id').notNull(),

    // Snapshot timestamp (when the cron captured this data)
    capturedAt: timestamp('captured_at', { withTimezone: true })
      .notNull()
      .defaultNow(),

    // Live instant-trade prices at capture time
    buyPrice: integer('buy_price'), // instant buy (high)
    sellPrice: integer('sell_price'), // instant sell (low)

    // Calculated spread at capture time
    margin: integer('margin'),

    // 5-minute interval averages
    avgHighPrice5m: integer('avg_high_price_5m'),
    avgLowPrice5m: integer('avg_low_price_5m'),
    volume5m: integer('volume_5m'),
    highPriceVolume5m: integer('high_price_volume_5m'),
    lowPriceVolume5m: integer('low_price_volume_5m'),

    // 1-hour interval averages
    avgHighPrice1h: integer('avg_high_price_1h'),
    avgLowPrice1h: integer('avg_low_price_1h'),
    volume1h: integer('volume_1h'),
    highPriceVolume1h: integer('high_price_volume_1h'),
    lowPriceVolume1h: integer('low_price_volume_1h'),

    // Buy limit (cached from mapping — rarely changes)
    buyLimit: integer('buy_limit'),
  },
  (table) => ({
    // Most common query: all history for one item, ordered by time
    itemCapturedAtIdx: index('ge_price_history_item_captured_at_idx').on(
      table.itemId,
      table.capturedAt
    ),
    // For pruning/retention queries
    capturedAtIdx: index('ge_price_history_captured_at_idx').on(
      table.capturedAt
    ),
    // Prevent duplicate snapshots for the same item+time
    itemCapturedAtUnique: unique('ge_price_history_item_captured_unique').on(
      table.itemId,
      table.capturedAt
    ),
  })
);

/**
 * GE Daily Summary — pre-aggregated daily stats per item.
 *
 * Materialized by the same cron that captures snapshots. Instead of
 * querying thousands of raw rows, trend analysis reads from this table.
 * One row per item per calendar day.
 */
export const geDailySummary = pgTable(
  'ge_daily_summary',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    itemId: integer('item_id').notNull(),

    // The calendar day this summary covers (midnight UTC)
    date: timestamp('date', { withTimezone: true }).notNull(),

    // Price range over the day
    avgBuyPrice: integer('avg_buy_price'),
    avgSellPrice: integer('avg_sell_price'),
    highBuyPrice: integer('high_buy_price'),
    lowBuyPrice: integer('low_buy_price'),
    highSellPrice: integer('high_sell_price'),
    lowSellPrice: integer('low_sell_price'),

    // Volume over the day (sum of 1h volumes across snapshots)
    totalVolume: bigint('total_volume', { mode: 'number' }),

    // Average margin and spread
    avgMargin: integer('avg_margin'),
    avgMarginPercent: real('avg_margin_percent'),

    // Number of snapshots that contributed to this summary
    snapshotCount: integer('snapshot_count').notNull().default(0),
  },
  (table) => ({
    // Primary lookup: item + date
    itemDateIdx: index('ge_daily_summary_item_date_idx').on(
      table.itemId,
      table.date
    ),
    // One summary per item per day
    itemDateUnique: unique('ge_daily_summary_item_date_unique').on(
      table.itemId,
      table.date
    ),
    // For finding all items on a given date
    dateIdx: index('ge_daily_summary_date_idx').on(table.date),
  })
);

// Type exports
export type GePriceHistory = typeof gePriceHistory.$inferSelect;
export type NewGePriceHistory = typeof gePriceHistory.$inferInsert;
export type GeDailySummary = typeof geDailySummary.$inferSelect;
export type NewGeDailySummary = typeof geDailySummary.$inferInsert;
