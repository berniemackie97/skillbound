import {
  and,
  asc,
  characterProfiles,
  desc,
  eq,
  geTrades,
  gte,
  ilike,
  sql,
  userCharacters,
  type GeTrade,
  type NewGeTrade,
} from '@skillbound/database';

import { getDbClient } from '../db';
import { logger } from '../logging/logger';

import { adjustBankroll, getBankroll, recalculateBankroll } from './bankroll';
import { getPeriodStartDate } from './helpers';
import {
  getInventoryPosition,
  recalculateInventoryPositions,
  updateInventoryOnBuy,
  updateInventoryOnSell,
} from './inventory';
import {
  type DeleteTradeImpact,
  type ItemProfitBreakdown,
  type TimePeriod,
  type TradeInput,
  type TradeValidationResult,
  TradeValidationError,
} from './types';

/**
 * Validate a trade before creation
 * Returns validation result with error details if invalid
 */
export async function validateTrade(
  characterId: string,
  input: TradeInput
): Promise<TradeValidationResult> {
  // Validate quantity
  if (input.quantity <= 0) {
    return {
      valid: false,
      error: 'Quantity must be greater than 0.',
      errorCode: 'INVALID_QUANTITY',
    };
  }

  // Validate quantity isn't unreasonably large (2.147B is max int in OSRS)
  if (input.quantity > 2_147_483_647) {
    return {
      valid: false,
      error: 'Quantity exceeds maximum allowed value.',
      errorCode: 'QUANTITY_TOO_LARGE',
    };
  }

  // Validate price (can be 0 for free items, but not negative)
  if (input.pricePerItem < 0) {
    return {
      valid: false,
      error: 'Price cannot be negative.',
      errorCode: 'NEGATIVE_PRICE',
    };
  }

  // Validate price isn't unreasonably large
  if (input.pricePerItem > 2_147_483_647) {
    return {
      valid: false,
      error: 'Price exceeds maximum allowed value.',
      errorCode: 'PRICE_TOO_LARGE',
    };
  }

  if (input.tradeType === 'buy') {
    const totalValue = input.quantity * input.pricePerItem;
    if (totalValue > 0) {
      const bankroll = await getBankroll(characterId);
      const available = Math.max(bankroll?.currentBankroll ?? 0, 0);
      if (totalValue > available) {
        return {
          valid: false,
          error: `Not enough bankroll. Available: ${available.toLocaleString()}`,
          errorCode: 'INSUFFICIENT_BANKROLL',
          availableBankroll: available,
        };
      }
    }
  }

  // For sell trades, validate that we have inventory to sell
  if (input.tradeType === 'sell') {
    const position = await getInventoryPosition(characterId, input.itemId);
    const availableQuantity = position?.remainingQuantity ?? 0;

    if (availableQuantity === 0) {
      return {
        valid: false,
        error: `You don't have any ${input.itemName} in your tracked inventory. Record a buy first, or the item may have come from another source.`,
        errorCode: 'NO_INVENTORY',
        availableQuantity: 0,
      };
    }

    if (input.quantity > availableQuantity) {
      return {
        valid: false,
        error: `You only have ${availableQuantity.toLocaleString()} ${input.itemName} available. Cannot sell ${input.quantity.toLocaleString()}.`,
        errorCode: 'INSUFFICIENT_INVENTORY',
        availableQuantity,
      };
    }
  }

  return { valid: true };
}

/**
 * Create a new trade for a character
 * Validates the trade first and throws TradeValidationError if invalid
 */
export async function createTrade(
  characterId: string,
  input: TradeInput
): Promise<GeTrade> {
  // Validate the trade first
  const validation = await validateTrade(characterId, input);
  if (!validation.valid) {
    throw new TradeValidationError(
      validation.error ?? 'Trade validation failed',
      validation.errorCode ?? 'VALIDATION_ERROR',
      validation.availableQuantity,
      validation.availableBankroll
    );
  }

  const db = getDbClient();
  const totalValue = input.quantity * input.pricePerItem;

  const tradeData: NewGeTrade = {
    userCharacterId: characterId,
    itemId: input.itemId,
    itemName: input.itemName,
    tradeType: input.tradeType,
    quantity: input.quantity,
    pricePerItem: input.pricePerItem,
    totalValue,
    tradedAt: input.tradedAt,
    notes: input.notes ?? null,
    source: 'manual',
  };

  const [trade] = await db.insert(geTrades).values(tradeData).returning();

  if (!trade) {
    throw new Error('Failed to create trade');
  }

  logger.info(
    { characterId, itemId: input.itemId, tradeType: input.tradeType },
    'Created trade'
  );

  // Update inventory positions
  if (input.tradeType === 'buy') {
    await updateInventoryOnBuy(
      characterId,
      input.itemId,
      input.itemName,
      input.quantity,
      input.pricePerItem,
      input.tradedAt
    );
    // Decrease bankroll when buying (spending money)
    await adjustBankroll(characterId, -totalValue);
  } else {
    // Sell trade - match with buys using FIFO and calculate profit
    await matchSellWithBuys(characterId, trade);
    await updateInventoryOnSell(characterId, input.itemId, input.quantity);
    // Increase bankroll when selling (receiving money)
    await adjustBankroll(characterId, totalValue);
  }

  return trade;
}

/**
 * Match a sell trade with buys using FIFO and calculate weighted average profit
 * Handles partial matching: if you buy 5 items and sell 3, 2 remain for future sells
 */
async function matchSellWithBuys(
  characterId: string,
  sellTrade: GeTrade
): Promise<void> {
  const db = getDbClient();

  // Get all buy trades for this item, ordered by date (FIFO)
  const buyTrades = await db
    .select()
    .from(geTrades)
    .where(
      and(
        eq(geTrades.userCharacterId, characterId),
        eq(geTrades.itemId, sellTrade.itemId),
        eq(geTrades.tradeType, 'buy')
      )
    )
    .orderBy(asc(geTrades.tradedAt));

  // Get all previous sells to calculate remaining quantities on buys
  const sellTrades = await db
    .select()
    .from(geTrades)
    .where(
      and(
        eq(geTrades.userCharacterId, characterId),
        eq(geTrades.itemId, sellTrade.itemId),
        eq(geTrades.tradeType, 'sell')
      )
    )
    .orderBy(asc(geTrades.tradedAt));

  // Build FIFO queue with remaining quantities
  const buyQueue: Array<{
    tradeId: string;
    remaining: number;
    pricePerItem: number;
  }> = buyTrades.map((t) => ({
    tradeId: t.id,
    remaining: t.quantity,
    pricePerItem: t.pricePerItem,
  }));

  // Process all previous sells (except current one) to deplete the buy queue
  for (const sell of sellTrades) {
    if (sell.id === sellTrade.id) continue; // Skip current sell

    let toMatch = sell.quantity;
    for (const buy of buyQueue) {
      if (toMatch <= 0) break;
      if (buy.remaining <= 0) continue;

      const matched = Math.min(toMatch, buy.remaining);
      buy.remaining -= matched;
      toMatch -= matched;
    }
  }

  // Now match the current sell with remaining buy inventory
  let sellRemaining = sellTrade.quantity;
  let totalMatchedProfit = 0;
  let totalMatchedQty = 0;
  let matchedBuyId: string | null = null;

  for (const buy of buyQueue) {
    if (sellRemaining <= 0) break;
    if (buy.remaining <= 0) continue;

    const matched = Math.min(sellRemaining, buy.remaining);
    const profitOnMatched =
      (sellTrade.pricePerItem - buy.pricePerItem) * matched;

    totalMatchedProfit += profitOnMatched;
    totalMatchedQty += matched;
    sellRemaining -= matched;

    // Track first matching buy for reference
    if (!matchedBuyId) {
      matchedBuyId = buy.tradeId;
    }
  }

  // Calculate weighted average profit per item
  const profitPerItem =
    totalMatchedQty > 0
      ? Math.round(totalMatchedProfit / totalMatchedQty)
      : null;

  // Update sell trade with profit info
  await db
    .update(geTrades)
    .set({
      matchedTradeId: matchedBuyId,
      profitPerItem: profitPerItem,
      totalProfit: totalMatchedQty > 0 ? totalMatchedProfit : null,
      updatedAt: new Date(),
    })
    .where(eq(geTrades.id, sellTrade.id));

  if (totalMatchedQty > 0) {
    logger.info(
      {
        sellTradeId: sellTrade.id,
        matchedBuyId,
        totalMatchedQty,
        totalMatchedProfit,
        unmatchedQty: sellRemaining,
      },
      'Matched sell with buys (FIFO)'
    );
  }
}

/**
 * Recalculate all profit matches for a character's trades
 * Uses proper FIFO with partial quantity matching
 * Useful after editing or deleting trades
 */
export async function recalculateProfitMatches(
  characterId: string
): Promise<{ matchesUpdated: number }> {
  const db = getDbClient();

  // Clear all existing matches for this character
  await db
    .update(geTrades)
    .set({
      matchedTradeId: null,
      profitPerItem: null,
      totalProfit: null,
      updatedAt: new Date(),
    })
    .where(eq(geTrades.userCharacterId, characterId));

  // Get all trades ordered by date
  const allTrades = await db
    .select()
    .from(geTrades)
    .where(eq(geTrades.userCharacterId, characterId))
    .orderBy(asc(geTrades.tradedAt));

  // Group trades by item
  const tradesByItem = new Map<number, GeTrade[]>();
  for (const trade of allTrades) {
    const existing = tradesByItem.get(trade.itemId) ?? [];
    existing.push(trade);
    tradesByItem.set(trade.itemId, existing);
  }

  let matchesUpdated = 0;

  // Process each item's trades separately
  for (const [, trades] of tradesByItem.entries()) {
    // Build FIFO buy queue with remaining quantities
    const buyQueue: Array<{
      tradeId: string;
      remaining: number;
      pricePerItem: number;
    }> = [];

    // Process trades in chronological order
    for (const trade of trades) {
      if (trade.tradeType === 'buy') {
        buyQueue.push({
          tradeId: trade.id,
          remaining: trade.quantity,
          pricePerItem: trade.pricePerItem,
        });
      } else {
        // Sell trade - match with buys using FIFO
        let sellRemaining = trade.quantity;
        let totalMatchedProfit = 0;
        let totalMatchedQty = 0;
        let firstMatchedBuyId: string | null = null;

        for (const buy of buyQueue) {
          if (sellRemaining <= 0) break;
          if (buy.remaining <= 0) continue;

          const matched = Math.min(sellRemaining, buy.remaining);
          const profitOnMatched =
            (trade.pricePerItem - buy.pricePerItem) * matched;

          totalMatchedProfit += profitOnMatched;
          totalMatchedQty += matched;
          buy.remaining -= matched;
          sellRemaining -= matched;

          if (!firstMatchedBuyId) {
            firstMatchedBuyId = buy.tradeId;
          }
        }

        // Calculate weighted average profit per item
        const profitPerItem =
          totalMatchedQty > 0
            ? Math.round(totalMatchedProfit / totalMatchedQty)
            : null;

        // Update sell trade with profit info
        if (totalMatchedQty > 0) {
          await db
            .update(geTrades)
            .set({
              matchedTradeId: firstMatchedBuyId,
              profitPerItem,
              totalProfit: totalMatchedProfit,
              updatedAt: new Date(),
            })
            .where(eq(geTrades.id, trade.id));

          matchesUpdated++;
        }
      }
    }
  }

  logger.info(
    { characterId, matchesUpdated },
    'Recalculated profit matches (FIFO)'
  );

  // Also recalculate inventory positions and bankroll
  await recalculateInventoryPositions(characterId);
  await recalculateBankroll(characterId);

  return { matchesUpdated };
}

/**
 * Get all trades for a character
 */
export async function getCharacterTrades(
  characterId: string,
  options: {
    period?: TimePeriod | undefined;
    itemId?: number | undefined;
    tradeType?: 'buy' | 'sell' | undefined;
    search?: string | undefined;
    limit?: number | undefined;
    offset?: number | undefined;
  } = {}
): Promise<{ trades: GeTrade[]; total: number }> {
  const db = getDbClient();
  const { period = 'all', itemId, tradeType, limit = 50, offset = 0 } = options;
  const search = options.search?.trim();

  const conditions = [eq(geTrades.userCharacterId, characterId)];

  const periodStart = getPeriodStartDate(period);
  if (periodStart) {
    conditions.push(gte(geTrades.tradedAt, periodStart));
  }

  if (itemId !== undefined) {
    conditions.push(eq(geTrades.itemId, itemId));
  }

  if (tradeType) {
    conditions.push(eq(geTrades.tradeType, tradeType));
  }

  if (search) {
    conditions.push(ilike(geTrades.itemName, `%${search}%`));
  }

  const [trades, countResult] = await Promise.all([
    db
      .select()
      .from(geTrades)
      .where(and(...conditions))
      .orderBy(desc(geTrades.tradedAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(geTrades)
      .where(and(...conditions)),
  ]);

  return {
    trades,
    total: Number(countResult[0]?.count ?? 0),
  };
}

export async function getUserTrades(
  userId: string,
  options: {
    period?: TimePeriod | undefined;
    itemId?: number | undefined;
    tradeType?: 'buy' | 'sell' | undefined;
    characterId?: string | undefined;
    search?: string | undefined;
    limit?: number | undefined;
    offset?: number | undefined;
  } = {}
): Promise<{
  trades: Array<GeTrade & { characterName: string }>;
  total: number;
}> {
  const db = getDbClient();
  const {
    period = 'all',
    itemId,
    tradeType,
    characterId,
    search,
    limit = 50,
    offset = 0,
  } = options;

  const conditions = [eq(userCharacters.userId, userId)];
  conditions.push(eq(characterProfiles.mode, 'normal'));

  const periodStart = getPeriodStartDate(period);
  if (periodStart) {
    conditions.push(gte(geTrades.tradedAt, periodStart));
  }

  if (characterId) {
    conditions.push(eq(geTrades.userCharacterId, characterId));
  }

  if (itemId !== undefined) {
    conditions.push(eq(geTrades.itemId, itemId));
  }

  if (tradeType) {
    conditions.push(eq(geTrades.tradeType, tradeType));
  }

  if (search) {
    conditions.push(ilike(geTrades.itemName, `%${search.trim()}%`));
  }

  const [records, countResult] = await Promise.all([
    db
      .select({
        trade: geTrades,
        characterName: characterProfiles.displayName,
      })
      .from(geTrades)
      .innerJoin(
        userCharacters,
        eq(geTrades.userCharacterId, userCharacters.id)
      )
      .innerJoin(
        characterProfiles,
        eq(userCharacters.profileId, characterProfiles.id)
      )
      .where(and(...conditions))
      .orderBy(desc(geTrades.tradedAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(geTrades)
      .innerJoin(
        userCharacters,
        eq(geTrades.userCharacterId, userCharacters.id)
      )
      .innerJoin(
        characterProfiles,
        eq(userCharacters.profileId, characterProfiles.id)
      )
      .where(and(...conditions)),
  ]);

  return {
    trades: records.map((record) => ({
      ...record.trade,
      characterName: record.characterName,
    })),
    total: Number(countResult[0]?.count ?? 0),
  };
}

/**
 * Get a single trade by ID
 */
export async function getTrade(
  characterId: string,
  tradeId: string
): Promise<GeTrade | null> {
  const db = getDbClient();

  const [trade] = await db
    .select()
    .from(geTrades)
    .where(
      and(eq(geTrades.id, tradeId), eq(geTrades.userCharacterId, characterId))
    )
    .limit(1);

  return trade ?? null;
}

/**
 * Update a trade
 */
export async function updateTrade(
  characterId: string,
  tradeId: string,
  updates: Partial<TradeInput>
): Promise<GeTrade | null> {
  const db = getDbClient();

  // Verify ownership
  const existing = await getTrade(characterId, tradeId);
  if (!existing) {
    return null;
  }

  const updateData: Partial<typeof geTrades.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (updates.itemId !== undefined) updateData.itemId = updates.itemId;
  if (updates.itemName !== undefined) updateData.itemName = updates.itemName;
  if (updates.quantity !== undefined) updateData.quantity = updates.quantity;
  if (updates.pricePerItem !== undefined)
    updateData.pricePerItem = updates.pricePerItem;
  if (updates.tradedAt !== undefined) updateData.tradedAt = updates.tradedAt;
  if (updates.notes !== undefined) updateData.notes = updates.notes;

  // Recalculate total value if quantity or price changed
  if (updates.quantity !== undefined || updates.pricePerItem !== undefined) {
    const quantity = updates.quantity ?? existing.quantity;
    const pricePerItem = updates.pricePerItem ?? existing.pricePerItem;
    updateData.totalValue = quantity * pricePerItem;
  }

  const [updated] = await db
    .update(geTrades)
    .set(updateData)
    .where(eq(geTrades.id, tradeId))
    .returning();

  // Recalculate matches if price or quantity changed
  if (updates.quantity !== undefined || updates.pricePerItem !== undefined) {
    await recalculateProfitMatches(characterId);
  }

  return updated ?? null;
}

/**
 * Analyze the impact of deleting a trade before actually deleting it
 */
export async function getDeleteTradeImpact(
  characterId: string,
  tradeId: string
): Promise<DeleteTradeImpact | null> {
  const db = getDbClient();

  const trade = await getTrade(characterId, tradeId);
  if (!trade) {
    return null;
  }

  const impact: DeleteTradeImpact = {
    trade: {
      id: trade.id,
      itemName: trade.itemName,
      tradeType: trade.tradeType,
      quantity: trade.quantity,
      totalValue: trade.totalValue,
    },
    affectedSells: [],
    matchedBuy: null,
    warningMessage: null,
  };

  if (trade.tradeType === 'buy') {
    // Find all sells that are currently matched to this buy
    const matchedSells = await db
      .select()
      .from(geTrades)
      .where(
        and(
          eq(geTrades.userCharacterId, characterId),
          eq(geTrades.matchedTradeId, tradeId)
        )
      );

    impact.affectedSells = matchedSells.map((sell) => ({
      id: sell.id,
      quantity: sell.quantity,
      tradedAt: sell.tradedAt,
      totalValue: sell.quantity * sell.pricePerItem,
    }));

    if (matchedSells.length > 0) {
      const totalAffectedQty = matchedSells.reduce(
        (sum, s) => sum + s.quantity,
        0
      );
      impact.warningMessage =
        `Deleting this buy will also delete ${matchedSells.length} linked sell trade(s) ` +
        `(${totalAffectedQty.toLocaleString()} items total).`;
    }
  } else {
    // For sells, find the matched buy
    if (trade.matchedTradeId) {
      const matchedBuy = await getTrade(characterId, trade.matchedTradeId);
      if (matchedBuy) {
        impact.matchedBuy = {
          id: matchedBuy.id,
          quantity: matchedBuy.quantity,
          tradedAt: matchedBuy.tradedAt,
        };
      }
    }
    // No special warning for deleting sells - they just get removed
  }

  return impact;
}

/**
 * Delete a trade
 * If deleting a buy, also deletes all sells that were matched to it
 */
export async function deleteTrade(
  characterId: string,
  tradeId: string
): Promise<{ success: boolean; deletedCount: number }> {
  const db = getDbClient();

  // Verify ownership
  const existing = await getTrade(characterId, tradeId);
  if (!existing) {
    return { success: false, deletedCount: 0 };
  }

  let deletedCount = 1;

  // If this is a buy, first delete all sells matched to it
  if (existing.tradeType === 'buy') {
    // Get matched sells to also reverse their bankroll impact
    const matchedSells = await db
      .select()
      .from(geTrades)
      .where(
        and(
          eq(geTrades.userCharacterId, characterId),
          eq(geTrades.matchedTradeId, tradeId)
        )
      );

    if (matchedSells.length > 0) {
      // Reverse bankroll for each deleted sell (subtract their sell value)
      for (const sell of matchedSells) {
        await adjustBankroll(characterId, -sell.totalValue);
      }

      await db.delete(geTrades).where(eq(geTrades.matchedTradeId, tradeId));

      deletedCount += matchedSells.length;
      logger.info(
        { characterId, tradeId, linkedSellsDeleted: matchedSells.length },
        'Deleted linked sells for buy trade'
      );
    }

    // Reverse bankroll for deleted buy (add back what was spent)
    await adjustBankroll(characterId, existing.totalValue);
  } else {
    // Reverse bankroll for deleted sell (subtract what was received)
    await adjustBankroll(characterId, -existing.totalValue);
  }

  // Delete the trade itself
  await db.delete(geTrades).where(eq(geTrades.id, tradeId));

  // Recalculate matches for remaining trades
  await recalculateProfitMatches(characterId);

  logger.info(
    { characterId, tradeId, totalDeleted: deletedCount },
    'Deleted trade'
  );
  return { success: true, deletedCount };
}

/**
 * Get profit breakdown for a specific item
 */
export async function getItemProfitBreakdown(
  characterId: string,
  itemId: number
): Promise<ItemProfitBreakdown | null> {
  const db = getDbClient();

  const trades = await db
    .select()
    .from(geTrades)
    .where(
      and(
        eq(geTrades.userCharacterId, characterId),
        eq(geTrades.itemId, itemId)
      )
    )
    .orderBy(desc(geTrades.tradedAt));

  if (trades.length === 0) {
    return null;
  }

  let totalBought = 0;
  let totalSold = 0;
  let totalSpent = 0;
  let totalEarned = 0;

  for (const trade of trades) {
    if (trade.tradeType === 'buy') {
      totalBought += trade.quantity;
      totalSpent += trade.totalValue;
    } else {
      totalSold += trade.quantity;
      totalEarned += trade.totalValue;
    }
  }

  const averageBuyPrice =
    totalBought > 0 ? Math.round(totalSpent / totalBought) : 0;
  const averageSellPrice =
    totalSold > 0 ? Math.round(totalEarned / totalSold) : 0;
  const averageMargin = averageSellPrice - averageBuyPrice;
  const marginPercent =
    averageBuyPrice > 0 ? (averageMargin / averageBuyPrice) * 100 : 0;

  const firstTrade = trades[0];
  if (!firstTrade) {
    throw new Error('No trades provided for item summary calculation');
  }

  return {
    itemId,
    itemName: firstTrade.itemName,
    totalBought,
    totalSold,
    totalSpent,
    totalEarned,
    netProfit: totalEarned - totalSpent,
    averageBuyPrice,
    averageSellPrice,
    averageMargin,
    marginPercent: Math.round(marginPercent * 100) / 100,
    tradeHistory: trades,
  };
}

/**
 * Get unique items traded by a character
 */
export async function getTradedItems(
  characterId: string
): Promise<Array<{ itemId: number; itemName: string; tradeCount: number }>> {
  const db = getDbClient();

  const result = await db
    .select({
      itemId: geTrades.itemId,
      itemName: geTrades.itemName,
      tradeCount: sql<number>`count(*)`,
    })
    .from(geTrades)
    .where(eq(geTrades.userCharacterId, characterId))
    .groupBy(geTrades.itemId, geTrades.itemName)
    .orderBy(desc(sql`count(*)`));

  return result.map((row) => ({
    itemId: row.itemId,
    itemName: row.itemName,
    tradeCount: Number(row.tradeCount),
  }));
}

/**
 * Get daily profit data for charts
 */
export async function getDailyProfitData(
  characterId: string,
  days: number = 30
): Promise<Array<{ date: string; profit: number; tradeCount: number }>> {
  const db = getDbClient();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const result = await db
    .select({
      date: sql<string>`DATE(traded_at)`,
      profit: sql<number>`COALESCE(SUM(total_profit), 0)`,
      tradeCount: sql<number>`count(*)`,
    })
    .from(geTrades)
    .where(
      and(
        eq(geTrades.userCharacterId, characterId),
        eq(geTrades.tradeType, 'sell'),
        gte(geTrades.tradedAt, startDate)
      )
    )
    .groupBy(sql`DATE(traded_at)`)
    .orderBy(sql`DATE(traded_at)`);

  return result.map((row) => ({
    date: row.date,
    profit: Number(row.profit),
    tradeCount: Number(row.tradeCount),
  }));
}
