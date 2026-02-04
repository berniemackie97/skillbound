import {
  and,
  characterProfiles,
  eq,
  geInventoryPositions,
  geTrades,
  gt,
  gte,
  sql,
  userCharacters,
} from '@skillbound/database';

import { getDbClient } from '../db';
import { getGeExchangeItems, getItemIconUrl } from './ge-service';
import { logger } from '../logging/logger';
import { getPeriodStartDate } from './helpers';
import { getInventoryPositions } from './inventory';
import type { ProfitSummary, TimePeriod } from './types';

/**
 * Get profit summary for a character with realized and unrealized P&L
 */
export async function getProfitSummary(
  characterId: string,
  period: TimePeriod = 'all'
): Promise<ProfitSummary> {
  const db = getDbClient();

  const conditions = [
    eq(geTrades.userCharacterId, characterId),
    eq(geTrades.tradeType, 'sell'),
  ];

  const periodStart = getPeriodStartDate(period);
  if (periodStart) {
    conditions.push(gte(geTrades.tradedAt, periodStart));
  }

  // Get all sell trades with profit data
  const sellTrades = await db
    .select()
    .from(geTrades)
    .where(and(...conditions));

  let totalProfit = 0;
  let totalRevenue = 0;
  let profitableCount = 0;
  let lossCount = 0;

  // Track complete flip data per item
  const flipData: Map<
    number,
    {
      name: string;
      profit: number;
      sellCount: number;
      totalSellQty: number;
      totalSellValue: number;
    }
  > = new Map();

  for (const trade of sellTrades) {
    totalRevenue += trade.totalValue;
    const profit = trade.totalProfit ?? 0;
    totalProfit += profit;

    if (profit > 0) {
      profitableCount++;
    } else if (profit < 0) {
      lossCount++;
    }

    // Track flip data per item
    const existing = flipData.get(trade.itemId) ?? {
      name: trade.itemName,
      profit: 0,
      sellCount: 0,
      totalSellQty: 0,
      totalSellValue: 0,
    };
    existing.profit += profit;
    existing.sellCount++;
    existing.totalSellQty += trade.quantity;
    existing.totalSellValue += trade.totalValue;
    flipData.set(trade.itemId, existing);
  }

  // Get buy data for flip calculations
  const buyConditions = [
    eq(geTrades.userCharacterId, characterId),
    eq(geTrades.tradeType, 'buy'),
  ];
  if (periodStart) {
    buyConditions.push(gte(geTrades.tradedAt, periodStart));
  }

  const buyTrades = await db
    .select()
    .from(geTrades)
    .where(and(...buyConditions));

  // Aggregate buy data per item
  const buyData: Map<
    number,
    { totalBuyQty: number; totalBuyValue: number }
  > = new Map();
  let totalCost = 0;

  for (const trade of buyTrades) {
    totalCost += trade.totalValue;
    const existing = buyData.get(trade.itemId) ?? {
      totalBuyQty: 0,
      totalBuyValue: 0,
    };
    existing.totalBuyQty += trade.quantity;
    existing.totalBuyValue += trade.totalValue;
    buyData.set(trade.itemId, existing);
  }

  // Calculate unrealized P&L from inventory positions
  const unrealizedData = await calculateUnrealizedPnL(characterId);

  // Build complete flip entries
  const flips = Array.from(flipData.entries()).map(([itemId, data]) => {
    const buy = buyData.get(itemId) ?? { totalBuyQty: 0, totalBuyValue: 0 };
    const avgBuyPrice = buy.totalBuyQty > 0 ? Math.round(buy.totalBuyValue / buy.totalBuyQty) : 0;
    const avgSellPrice = data.totalSellQty > 0 ? Math.round(data.totalSellValue / data.totalSellQty) : 0;
    const costBasis = data.totalSellQty * avgBuyPrice; // Approximate cost for sold items
    const roi = costBasis > 0 ? Math.round((data.profit / costBasis) * 10000) / 100 : 0;

    return {
      itemId,
      itemName: data.name,
      iconUrl: unrealizedData.itemIcons.get(itemId) ?? '',
      profit: data.profit,
      totalBought: buy.totalBuyQty,
      totalSold: data.totalSellQty,
      flipCount: data.sellCount,
      avgBuyPrice,
      avgSellPrice,
      roi,
    };
  });

  // Sort flips by profit and split into winners/losers
  const sortedFlips = flips.sort((a, b) => b.profit - a.profit);

  const topFlips = sortedFlips
    .filter((f) => f.profit > 0)
    .slice(0, 5);

  const topLossFlips = sortedFlips
    .filter((f) => f.profit < 0)
    .sort((a, b) => a.profit - b.profit)
    .slice(0, 5)
    .map((f) => ({ ...f, loss: -f.profit }));

  // Legacy format for backward compatibility
  const topProfitableItems = topFlips.map((f) => ({
    itemId: f.itemId,
    itemName: f.itemName,
    iconUrl: f.iconUrl,
    profit: f.profit,
    tradeCount: f.flipCount,
  }));

  const topLossItems = topLossFlips.map((f) => ({
    itemId: f.itemId,
    itemName: f.itemName,
    iconUrl: f.iconUrl,
    loss: -f.profit,
    tradeCount: f.flipCount,
  }));

  return {
    totalProfit,
    totalRevenue,
    totalCost,
    tradeCount: sellTrades.length,
    profitableTradeCount: profitableCount,
    lossTradeCount: lossCount,
    averageProfitPerTrade:
      sellTrades.length > 0 ? totalProfit / sellTrades.length : 0,
    unrealizedProfit: unrealizedData.totalUnrealizedPnL,
    unrealizedPositions: unrealizedData.positions,
    totalPnL: totalProfit + unrealizedData.totalUnrealizedPnL,
    topFlips,
    topLossFlips,
    topProfitableItems,
    topLossItems,
  };
}

/**
 * Calculate unrealized P&L from inventory positions using current market prices
 */
async function calculateUnrealizedPnL(characterId: string): Promise<{
  totalUnrealizedPnL: number;
  positions: ProfitSummary['unrealizedPositions'];
  itemIcons: Map<number, string>;
}> {
  // Get inventory positions with remaining quantity > 0
  const inventoryPositions = await getInventoryPositions(characterId, {
    onlyWithRemaining: true,
  });

  const itemIcons: Map<number, string> = new Map();

  if (inventoryPositions.length === 0) {
    return { totalUnrealizedPnL: 0, positions: [], itemIcons };
  }

  // Get current market prices and icons
  let marketPrices: Map<number, number | null> = new Map();
  try {
    const geItems = await getGeExchangeItems();
    for (const item of geItems) {
      // Use sell price (instant sell) as the realistic exit price
      marketPrices.set(item.id, item.sellPrice);
      // Store icon URL
      itemIcons.set(item.id, getItemIconUrl(item.icon));
    }
  } catch (error) {
    logger.warn({ error }, 'Failed to fetch GE prices for unrealized P&L');
    // Continue with null prices - will show positions without current value
  }

  let totalUnrealizedPnL = 0;
  const positions: ProfitSummary['unrealizedPositions'] = [];

  for (const position of inventoryPositions) {
    const currentPrice = marketPrices.get(position.itemId) ?? null;
    const costBasis = position.remainingQuantity * position.averageBuyPrice;
    const marketValue =
      currentPrice !== null ? position.remainingQuantity * currentPrice : costBasis;
    const unrealizedPnL = marketValue - costBasis;
    const iconUrl = itemIcons.get(position.itemId) ?? '';

    totalUnrealizedPnL += unrealizedPnL;

    positions.push({
      itemId: position.itemId,
      itemName: position.itemName,
      iconUrl,
      quantity: position.remainingQuantity,
      costBasis,
      marketValue,
      unrealizedPnL,
      currentPrice,
    });
  }

  // Sort by unrealized P&L (most profit/loss first)
  positions.sort((a, b) => Math.abs(b.unrealizedPnL) - Math.abs(a.unrealizedPnL));

  return { totalUnrealizedPnL, positions, itemIcons };
}

export async function getUserProfitSummary(
  userId: string,
  period: TimePeriod = 'all',
  characterId?: string
): Promise<ProfitSummary> {
  const db = getDbClient();

  const conditions = [
    eq(userCharacters.userId, userId),
    eq(geTrades.tradeType, 'sell'),
  ];
  conditions.push(eq(characterProfiles.mode, 'normal'));

  if (characterId) {
    conditions.push(eq(geTrades.userCharacterId, characterId));
  }

  const periodStart = getPeriodStartDate(period);
  if (periodStart) {
    conditions.push(gte(geTrades.tradedAt, periodStart));
  }

  const sellTrades = await db
    .select({
      trade: geTrades,
      characterName: characterProfiles.displayName,
    })
    .from(geTrades)
    .innerJoin(userCharacters, eq(geTrades.userCharacterId, userCharacters.id))
    .innerJoin(
      characterProfiles,
      eq(userCharacters.profileId, characterProfiles.id)
    )
    .where(and(...conditions));

  let totalProfit = 0;
  let totalRevenue = 0;
  let profitableCount = 0;
  let lossCount = 0;

  // Track complete flip data per item
  const flipData: Map<
    number,
    {
      name: string;
      profit: number;
      sellCount: number;
      totalSellQty: number;
      totalSellValue: number;
    }
  > = new Map();

  for (const record of sellTrades) {
    const trade = record.trade;
    totalRevenue += trade.totalValue;
    const profit = trade.totalProfit ?? 0;
    totalProfit += profit;

    if (profit > 0) {
      profitableCount++;
    } else if (profit < 0) {
      lossCount++;
    }

    // Track flip data per item
    const existing = flipData.get(trade.itemId) ?? {
      name: trade.itemName,
      profit: 0,
      sellCount: 0,
      totalSellQty: 0,
      totalSellValue: 0,
    };
    existing.profit += profit;
    existing.sellCount++;
    existing.totalSellQty += trade.quantity;
    existing.totalSellValue += trade.totalValue;
    flipData.set(trade.itemId, existing);
  }

  // Get buy data for flip calculations
  const buyConditions = [
    eq(userCharacters.userId, userId),
    eq(geTrades.tradeType, 'buy'),
  ];
  buyConditions.push(eq(characterProfiles.mode, 'normal'));
  if (characterId) {
    buyConditions.push(eq(geTrades.userCharacterId, characterId));
  }
  if (periodStart) {
    buyConditions.push(gte(geTrades.tradedAt, periodStart));
  }

  const buyTrades = await db
    .select({ trade: geTrades })
    .from(geTrades)
    .innerJoin(userCharacters, eq(geTrades.userCharacterId, userCharacters.id))
    .innerJoin(
      characterProfiles,
      eq(userCharacters.profileId, characterProfiles.id)
    )
    .where(and(...buyConditions));

  // Aggregate buy data per item
  const buyDataMap: Map<
    number,
    { totalBuyQty: number; totalBuyValue: number }
  > = new Map();
  let totalCost = 0;

  for (const record of buyTrades) {
    const trade = record.trade;
    totalCost += trade.totalValue;
    const existing = buyDataMap.get(trade.itemId) ?? {
      totalBuyQty: 0,
      totalBuyValue: 0,
    };
    existing.totalBuyQty += trade.quantity;
    existing.totalBuyValue += trade.totalValue;
    buyDataMap.set(trade.itemId, existing);
  }

  // Calculate unrealized P&L across all characters or specific character
  const unrealizedData = await calculateUserUnrealizedPnL(userId, characterId);

  // Build complete flip entries
  const flips = Array.from(flipData.entries()).map(([itemId, data]) => {
    const buy = buyDataMap.get(itemId) ?? { totalBuyQty: 0, totalBuyValue: 0 };
    const avgBuyPrice = buy.totalBuyQty > 0 ? Math.round(buy.totalBuyValue / buy.totalBuyQty) : 0;
    const avgSellPrice = data.totalSellQty > 0 ? Math.round(data.totalSellValue / data.totalSellQty) : 0;
    const costBasis = data.totalSellQty * avgBuyPrice;
    const roi = costBasis > 0 ? Math.round((data.profit / costBasis) * 10000) / 100 : 0;

    return {
      itemId,
      itemName: data.name,
      iconUrl: unrealizedData.itemIcons.get(itemId) ?? '',
      profit: data.profit,
      totalBought: buy.totalBuyQty,
      totalSold: data.totalSellQty,
      flipCount: data.sellCount,
      avgBuyPrice,
      avgSellPrice,
      roi,
    };
  });

  // Sort flips by profit and split into winners/losers
  const sortedFlips = flips.sort((a, b) => b.profit - a.profit);

  const topFlips = sortedFlips
    .filter((f) => f.profit > 0)
    .slice(0, 5);

  const topLossFlips = sortedFlips
    .filter((f) => f.profit < 0)
    .sort((a, b) => a.profit - b.profit)
    .slice(0, 5)
    .map((f) => ({ ...f, loss: -f.profit }));

  // Legacy format for backward compatibility
  const topProfitableItems = topFlips.map((f) => ({
    itemId: f.itemId,
    itemName: f.itemName,
    iconUrl: f.iconUrl,
    profit: f.profit,
    tradeCount: f.flipCount,
  }));

  const topLossItems = topLossFlips.map((f) => ({
    itemId: f.itemId,
    itemName: f.itemName,
    iconUrl: f.iconUrl,
    loss: -f.profit,
    tradeCount: f.flipCount,
  }));

  return {
    totalProfit,
    totalRevenue,
    totalCost,
    tradeCount: sellTrades.length,
    profitableTradeCount: profitableCount,
    lossTradeCount: lossCount,
    averageProfitPerTrade:
      sellTrades.length > 0 ? totalProfit / sellTrades.length : 0,
    unrealizedProfit: unrealizedData.totalUnrealizedPnL,
    unrealizedPositions: unrealizedData.positions,
    totalPnL: totalProfit + unrealizedData.totalUnrealizedPnL,
    topProfitableItems,
    topLossItems,
    topFlips,
    topLossFlips,
  };
}

/**
 * Calculate unrealized P&L across all characters for a user
 */
async function calculateUserUnrealizedPnL(
  userId: string,
  characterId?: string
): Promise<{
  totalUnrealizedPnL: number;
  positions: ProfitSummary['unrealizedPositions'];
  itemIcons: Map<number, string>;
}> {
  const db = getDbClient();
  const itemIcons: Map<number, string> = new Map();

  // Get all character IDs for this user (normal mode only)
  const characters = await db
    .select({ id: userCharacters.id })
    .from(userCharacters)
    .innerJoin(
      characterProfiles,
      eq(userCharacters.profileId, characterProfiles.id)
    )
    .where(
      and(eq(userCharacters.userId, userId), eq(characterProfiles.mode, 'normal'))
    );

  const characterIds = characterId
    ? [characterId]
    : characters.map((c) => c.id);

  if (characterIds.length === 0) {
    return { totalUnrealizedPnL: 0, positions: [], itemIcons };
  }

  // Get all inventory positions across characters
  const allPositions = await db
    .select()
    .from(geInventoryPositions)
    .where(
      and(
        sql`${geInventoryPositions.userCharacterId} = ANY(${sql.raw(`ARRAY[${characterIds.map((id) => `'${id}'`).join(',')}]::uuid[]`)})`,
        gt(geInventoryPositions.remainingQuantity, 0)
      )
    );

  if (allPositions.length === 0) {
    return { totalUnrealizedPnL: 0, positions: [], itemIcons };
  }

  // Get current market prices and icons
  let marketPrices: Map<number, number | null> = new Map();
  try {
    const geItems = await getGeExchangeItems();
    for (const item of geItems) {
      marketPrices.set(item.id, item.sellPrice);
      itemIcons.set(item.id, getItemIconUrl(item.icon));
    }
  } catch (error) {
    logger.warn({ error }, 'Failed to fetch GE prices for user unrealized P&L');
  }

  // Aggregate positions by item (across all characters)
  const aggregated: Map<
    number,
    { itemName: string; quantity: number; totalCost: number }
  > = new Map();

  for (const position of allPositions) {
    const existing = aggregated.get(position.itemId);
    const positionCost = position.remainingQuantity * position.averageBuyPrice;

    if (existing) {
      existing.quantity += position.remainingQuantity;
      existing.totalCost += positionCost;
    } else {
      aggregated.set(position.itemId, {
        itemName: position.itemName,
        quantity: position.remainingQuantity,
        totalCost: positionCost,
      });
    }
  }

  let totalUnrealizedPnL = 0;
  const positions: ProfitSummary['unrealizedPositions'] = [];

  for (const [itemId, data] of aggregated.entries()) {
    const currentPrice = marketPrices.get(itemId) ?? null;
    const marketValue =
      currentPrice !== null ? data.quantity * currentPrice : data.totalCost;
    const unrealizedPnL = marketValue - data.totalCost;
    const iconUrl = itemIcons.get(itemId) ?? '';

    totalUnrealizedPnL += unrealizedPnL;

    positions.push({
      itemId,
      itemName: data.itemName,
      iconUrl,
      quantity: data.quantity,
      costBasis: data.totalCost,
      marketValue,
      unrealizedPnL,
      currentPrice,
    });
  }

  positions.sort((a, b) => Math.abs(b.unrealizedPnL) - Math.abs(a.unrealizedPnL));

  return { totalUnrealizedPnL, positions, itemIcons };
}
