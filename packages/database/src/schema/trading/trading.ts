import {
  bigint,
  boolean,
  decimal,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

import { userCharacters } from '../characters/characters';

/**
 * Trading bankroll/liquidity table
 * Tracks the GP a character is using for flipping/trading
 */
export const geTradingBankroll = pgTable(
  'ge_trading_bankroll',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userCharacterId: uuid('user_character_id')
      .notNull()
      .unique()
      .references(() => userCharacters.id, { onDelete: 'cascade' }),

    // Current liquidity/bankroll
    currentBankroll: bigint('current_bankroll', { mode: 'number' })
      .notNull()
      .default(0),

    // Initial bankroll (for calculating overall ROI)
    initialBankroll: bigint('initial_bankroll', { mode: 'number' })
      .notNull()
      .default(0),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    characterIdIdx: index('ge_trading_bankroll_character_id_idx').on(
      table.userCharacterId
    ),
  })
);

/**
 * Trade type enum
 */
export const tradeTypeEnum = pgEnum('trade_type', ['buy', 'sell']);

/**
 * Trade source enum
 */
export const tradeSourceEnum = pgEnum('trade_source', [
  'manual',
  'auto-import',
]);

/**
 * Profit potential enum
 */
export const profitPotentialEnum = pgEnum('profit_potential', [
  'high',
  'medium',
  'low',
]);

/**
 * GE trades table
 * Tracks buy/sell trades for profit calculation
 */
export const geTrades = pgTable(
  'ge_trades',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userCharacterId: uuid('user_character_id')
      .notNull()
      .references(() => userCharacters.id, { onDelete: 'cascade' }),
    itemId: integer('item_id').notNull(),
    itemName: text('item_name').notNull(), // Denormalized for display

    // Trade details
    tradeType: tradeTypeEnum('trade_type').notNull(),
    quantity: integer('quantity').notNull(),
    pricePerItem: integer('price_per_item').notNull(), // GP
    totalValue: bigint('total_value', { mode: 'number' }).notNull(), // quantity * pricePerItem

    // Timestamps
    tradedAt: timestamp('traded_at', { withTimezone: true }).notNull(),

    // Matching for profit calculation
    matchedTradeId: uuid('matched_trade_id'),
    profitPerItem: integer('profit_per_item'), // Calculated on sell
    totalProfit: bigint('total_profit', { mode: 'number' }), // Total profit/loss

    // Metadata
    notes: text('notes'),
    source: tradeSourceEnum('source').notNull().default('manual'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    // Index for querying all trades for a character
    characterIdIdx: index('ge_trades_character_id_idx').on(
      table.userCharacterId
    ),
    // Index for item price history
    itemIdIdx: index('ge_trades_item_id_idx').on(table.itemId),
    // Index for time-based queries (recent trades)
    tradedAtIdx: index('ge_trades_traded_at_idx').on(table.tradedAt),
    // Composite index for character's trades of a specific item
    characterItemIdx: index('ge_trades_character_item_idx').on(
      table.userCharacterId,
      table.itemId
    ),
    // Index for character's recent trades (most common query pattern)
    characterTradedAtIdx: index('ge_trades_character_traded_at_idx').on(
      table.userCharacterId,
      table.tradedAt
    ),
    // Index for unmatched trades (for profit calculation)
    matchedTradeIdIdx: index('ge_trades_matched_trade_id_idx').on(
      table.matchedTradeId
    ),
    // Index for filtering by trade type
    characterTypeIdx: index('ge_trades_character_type_idx').on(
      table.userCharacterId,
      table.tradeType
    ),
  })
);

/**
 * GE watch items table
 * Items being tracked for price alerts
 */
export const geWatchItems = pgTable(
  'ge_watch_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userCharacterId: uuid('user_character_id')
      .notNull()
      .references(() => userCharacters.id, { onDelete: 'cascade' }),
    itemId: integer('item_id').notNull(),
    itemName: text('item_name').notNull(), // Denormalized

    // Alert thresholds
    alertOnMargin: integer('alert_on_margin'), // GP margin threshold
    alertOnBuyPrice: integer('alert_on_buy_price'), // Alert when buy <= X
    alertOnSellPrice: integer('alert_on_sell_price'), // Alert when sell >= X
    alertOnVolume: integer('alert_on_volume'), // Daily volume threshold

    // State
    isActive: boolean('is_active').notNull().default(true),
    lastAlertedAt: timestamp('last_alerted_at', { withTimezone: true }),

    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    // UNIQUE CONSTRAINT: One watch entry per character/item
    // Prevents duplicate watch list entries
    characterItemUnique: unique('ge_watch_items_character_item_unique').on(
      table.userCharacterId,
      table.itemId
    ),
    // Index for querying all watch items for a character
    characterIdIdx: index('ge_watch_items_character_id_idx').on(
      table.userCharacterId
    ),
    // Index for filtering active watch items
    characterActiveIdx: index('ge_watch_items_character_active_idx').on(
      table.userCharacterId,
      table.isActive
    ),
    // Index for item lookup (which characters watch this item)
    itemIdIdx: index('ge_watch_items_item_id_idx').on(table.itemId),
  })
);

/**
 * GE inventory positions table
 * Tracks currently held items with remaining quantities from buys
 * This supports partial sells by tracking how much of each buy remains
 */
export const geInventoryPositions = pgTable(
  'ge_inventory_positions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userCharacterId: uuid('user_character_id')
      .notNull()
      .references(() => userCharacters.id, { onDelete: 'cascade' }),
    itemId: integer('item_id').notNull(),
    itemName: text('item_name').notNull(),

    // Quantity tracking
    totalQuantity: integer('total_quantity').notNull(), // Total bought
    remainingQuantity: integer('remaining_quantity').notNull(), // Still held (not yet sold)
    averageBuyPrice: integer('average_buy_price').notNull(), // Weighted average

    // Value tracking
    totalCost: bigint('total_cost', { mode: 'number' }).notNull(), // Total spent

    // Timestamps
    firstBuyAt: timestamp('first_buy_at', { withTimezone: true }).notNull(),
    lastBuyAt: timestamp('last_buy_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    // UNIQUE CONSTRAINT: One position per character/item
    characterItemUnique: unique(
      'ge_inventory_positions_character_item_unique'
    ).on(table.userCharacterId, table.itemId),
    // Index for querying all positions for a character
    characterIdIdx: index('ge_inventory_positions_character_id_idx').on(
      table.userCharacterId
    ),
    // Index for positions with remaining items
    characterRemainingIdx: index(
      'ge_inventory_positions_character_remaining_idx'
    ).on(table.userCharacterId, table.remainingQuantity),
  })
);

/**
 * GE flip suggestions table
 * Pre-calculated high-margin items for flipping
 */
export const geFlipSuggestions = pgTable(
  'ge_flip_suggestions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    itemId: integer('item_id').notNull().unique(),
    itemName: text('item_name').notNull(),

    // Calculated metrics
    currentMargin: integer('current_margin').notNull(), // sell - buy
    marginPercent: decimal('margin_percent', {
      precision: 10,
      scale: 2,
    }).notNull(), // margin / buy * 100
    buyPrice: integer('buy_price').notNull(),
    sellPrice: integer('sell_price').notNull(),
    dailyVolume: integer('daily_volume'),
    profitPotential: profitPotentialEnum('profit_potential').notNull(),

    // Flip quality scoring
    flipQualityGrade: text('flip_quality_grade'), // A-F
    flipQualityScore: integer('flip_quality_score'), // 0-100
    qualityLiquidity: integer('quality_liquidity'),
    qualityStaleness: integer('quality_staleness'),
    qualityMarginStability: integer('quality_margin_stability'),
    qualityVolumeAdequacy: integer('quality_volume_adequacy'),
    qualityBuyPressure: integer('quality_buy_pressure'),
    qualityTaxEfficiency: integer('quality_tax_efficiency'),
    qualityFlags: text('quality_flags')
      .array()
      .notNull()
      .default([]),

    // Metadata
    calculatedAt: timestamp('calculated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    dataSource: text('data_source').notNull().default('wiki_api'),
  },
  (table) => ({
    marginPercentIdx: index('ge_flip_margin_percent_idx').on(
      table.marginPercent
    ),
    calculatedAtIdx: index('ge_flip_calculated_at_idx').on(table.calculatedAt),
    profitPotentialIdx: index('ge_flip_profit_potential_idx').on(
      table.profitPotential
    ),
    flipQualityGradeIdx: index('ge_flip_quality_grade_idx').on(
      table.flipQualityGrade
    ),
    flipQualityScoreIdx: index('ge_flip_quality_score_idx').on(
      table.flipQualityScore
    ),
  })
);

/**
 * Type definitions
 */
export type GeTrade = typeof geTrades.$inferSelect;
export type NewGeTrade = typeof geTrades.$inferInsert;
export type GeWatchItem = typeof geWatchItems.$inferSelect;
export type NewGeWatchItem = typeof geWatchItems.$inferInsert;
export type GeFlipSuggestion = typeof geFlipSuggestions.$inferSelect;
export type NewGeFlipSuggestion = typeof geFlipSuggestions.$inferInsert;
export type GeTradingBankroll = typeof geTradingBankroll.$inferSelect;
export type NewGeTradingBankroll = typeof geTradingBankroll.$inferInsert;
export type GeInventoryPosition = typeof geInventoryPositions.$inferSelect;
export type NewGeInventoryPosition = typeof geInventoryPositions.$inferInsert;
