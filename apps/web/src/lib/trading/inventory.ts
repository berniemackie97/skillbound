import {
  and,
  asc,
  desc,
  eq,
  geInventoryPositions,
  geTrades,
  gt,
  sql,
  type GeInventoryPosition,
  type NewGeInventoryPosition,
} from '@skillbound/database';

import { getDbClient } from '../db';
import { getGeExchangeItems, getItemIconUrl } from './ge-service';
import { logger } from '../logging/logger';

/**
 * Get all inventory positions for a character
 */
export async function getInventoryPositions(
  characterId: string,
  options: {
    onlyWithRemaining?: boolean | undefined;
    itemId?: number | undefined;
  } = {}
): Promise<GeInventoryPosition[]> {
  const db = getDbClient();

  const conditions = [eq(geInventoryPositions.userCharacterId, characterId)];

  if (options.onlyWithRemaining) {
    conditions.push(gt(geInventoryPositions.remainingQuantity, 0));
  }

  if (options.itemId !== undefined) {
    conditions.push(eq(geInventoryPositions.itemId, options.itemId));
  }

  return db
    .select()
    .from(geInventoryPositions)
    .where(and(...conditions))
    .orderBy(desc(geInventoryPositions.lastBuyAt));
}

/**
 * Get a single inventory position
 */
export async function getInventoryPosition(
  characterId: string,
  itemId: number
): Promise<GeInventoryPosition | null> {
  const db = getDbClient();

  const [position] = await db
    .select()
    .from(geInventoryPositions)
    .where(
      and(
        eq(geInventoryPositions.userCharacterId, characterId),
        eq(geInventoryPositions.itemId, itemId)
      )
    )
    .limit(1);

  return position ?? null;
}

/**
 * Update inventory position when a buy is recorded
 * Calculates weighted average buy price
 */
export async function updateInventoryOnBuy(
  characterId: string,
  itemId: number,
  itemName: string,
  quantity: number,
  pricePerItem: number,
  tradedAt: Date
): Promise<GeInventoryPosition> {
  const db = getDbClient();

  const existing = await getInventoryPosition(characterId, itemId);
  const totalCost = quantity * pricePerItem;

  if (existing) {
    // Update existing position with weighted average
    const newTotalQuantity = existing.totalQuantity + quantity;
    const newRemainingQuantity = existing.remainingQuantity + quantity;
    const newTotalCost = existing.totalCost + totalCost;
    const newAverageBuyPrice = Math.round(newTotalCost / newTotalQuantity);

    const [updated] = await db
      .update(geInventoryPositions)
      .set({
        totalQuantity: newTotalQuantity,
        remainingQuantity: newRemainingQuantity,
        averageBuyPrice: newAverageBuyPrice,
        totalCost: newTotalCost,
        lastBuyAt: tradedAt,
        updatedAt: new Date(),
      })
      .where(eq(geInventoryPositions.id, existing.id))
      .returning();

    if (!updated) {
      throw new Error('Failed to update inventory position');
    }

    return updated;
  }

  // Create new position
  const positionData: NewGeInventoryPosition = {
    userCharacterId: characterId,
    itemId,
    itemName,
    totalQuantity: quantity,
    remainingQuantity: quantity,
    averageBuyPrice: pricePerItem,
    totalCost,
    firstBuyAt: tradedAt,
    lastBuyAt: tradedAt,
  };

  const [created] = await db
    .insert(geInventoryPositions)
    .values(positionData)
    .returning();

  if (!created) {
    throw new Error('Failed to create inventory position');
  }

  return created;
}

/**
 * Update inventory position when a sell is recorded
 * Reduces remaining quantity
 */
export async function updateInventoryOnSell(
  characterId: string,
  itemId: number,
  quantity: number
): Promise<GeInventoryPosition | null> {
  const db = getDbClient();

  const existing = await getInventoryPosition(characterId, itemId);

  if (!existing) {
    // No position exists - this is a sell without a tracked buy (item from other source)
    return null;
  }

  const newRemainingQuantity = Math.max(0, existing.remainingQuantity - quantity);

  const [updated] = await db
    .update(geInventoryPositions)
    .set({
      remainingQuantity: newRemainingQuantity,
      updatedAt: new Date(),
    })
    .where(eq(geInventoryPositions.id, existing.id))
    .returning();

  return updated ?? null;
}

/**
 * Recalculate all inventory positions for a character from trade history
 */
export async function recalculateInventoryPositions(
  characterId: string
): Promise<{ positionsUpdated: number }> {
  const db = getDbClient();

  // Delete all existing positions for this character
  await db
    .delete(geInventoryPositions)
    .where(eq(geInventoryPositions.userCharacterId, characterId));

  // Get all trades ordered by date
  const allTrades = await db
    .select()
    .from(geTrades)
    .where(eq(geTrades.userCharacterId, characterId))
    .orderBy(asc(geTrades.tradedAt));

  // Track positions per item
  const positions: Map<
    number,
    {
      itemName: string;
      totalQuantity: number;
      remainingQuantity: number;
      totalCost: number;
      firstBuyAt: Date;
      lastBuyAt: Date;
    }
  > = new Map();

  for (const trade of allTrades) {
    const existing = positions.get(trade.itemId);

    if (trade.tradeType === 'buy') {
      const tradeCost = trade.quantity * trade.pricePerItem;

      if (existing) {
        existing.totalQuantity += trade.quantity;
        existing.remainingQuantity += trade.quantity;
        existing.totalCost += tradeCost;
        existing.lastBuyAt = trade.tradedAt;
      } else {
        positions.set(trade.itemId, {
          itemName: trade.itemName,
          totalQuantity: trade.quantity,
          remainingQuantity: trade.quantity,
          totalCost: tradeCost,
          firstBuyAt: trade.tradedAt,
          lastBuyAt: trade.tradedAt,
        });
      }
    } else {
      // Sell - reduce remaining quantity
      if (existing) {
        existing.remainingQuantity = Math.max(
          0,
          existing.remainingQuantity - trade.quantity
        );
      }
    }
  }

  // Insert all positions
  let positionsUpdated = 0;
  for (const [itemId, data] of positions.entries()) {
    if (data.totalQuantity > 0) {
      const averageBuyPrice = Math.round(data.totalCost / data.totalQuantity);

      await db.insert(geInventoryPositions).values({
        userCharacterId: characterId,
        itemId,
        itemName: data.itemName,
        totalQuantity: data.totalQuantity,
        remainingQuantity: data.remainingQuantity,
        averageBuyPrice,
        totalCost: data.totalCost,
        firstBuyAt: data.firstBuyAt,
        lastBuyAt: data.lastBuyAt,
      });

      positionsUpdated++;
    }
  }

  logger.info({ characterId, positionsUpdated }, 'Recalculated inventory positions');
  return { positionsUpdated };
}

/**
 * Get inventory summary (total value of held items)
 */
export async function getInventorySummary(characterId: string): Promise<{
  totalPositions: number;
  totalHeldItems: number;
  totalHeldValue: number;
  positions: Array<{
    itemId: number;
    itemName: string;
    iconUrl: string;
    remainingQuantity: number;
    averageBuyPrice: number;
    heldValue: number;
  }>;
}> {
  const db = getDbClient();

  const positions = await db
    .select()
    .from(geInventoryPositions)
    .where(
      and(
        eq(geInventoryPositions.userCharacterId, characterId),
        gt(geInventoryPositions.remainingQuantity, 0)
      )
    )
    .orderBy(desc(sql`remaining_quantity * average_buy_price`));

  // Fetch item icons
  const itemIcons: Map<number, string> = new Map();
  try {
    const geItems = await getGeExchangeItems();
    for (const item of geItems) {
      itemIcons.set(item.id, getItemIconUrl(item.icon));
    }
  } catch {
    // Continue without icons if fetch fails
  }

  let totalHeldItems = 0;
  let totalHeldValue = 0;

  const positionDetails = positions.map((pos) => {
    const heldValue = pos.remainingQuantity * pos.averageBuyPrice;
    totalHeldItems += pos.remainingQuantity;
    totalHeldValue += heldValue;

    return {
      itemId: pos.itemId,
      itemName: pos.itemName,
      iconUrl: itemIcons.get(pos.itemId) ?? '',
      remainingQuantity: pos.remainingQuantity,
      averageBuyPrice: pos.averageBuyPrice,
      heldValue,
    };
  });

  return {
    totalPositions: positions.length,
    totalHeldItems,
    totalHeldValue,
    positions: positionDetails,
  };
}
