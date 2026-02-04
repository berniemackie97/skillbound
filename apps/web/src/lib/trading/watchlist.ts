import {
  and,
  asc,
  eq,
  geWatchItems,
  type GeWatchItem,
  type NewGeWatchItem,
} from '@skillbound/database';

import { getDbClient } from '../db';
import { logger } from '../logging/logger';

/**
 * Add an item to the watch list
 */
export async function addWatchItem(
  characterId: string,
  input: {
    itemId: number;
    itemName: string;
    alertOnMargin?: number | undefined;
    alertOnBuyPrice?: number | undefined;
    alertOnSellPrice?: number | undefined;
    alertOnVolume?: number | undefined;
    notes?: string | undefined;
  }
): Promise<GeWatchItem> {
  const db = getDbClient();

  const watchData: NewGeWatchItem = {
    userCharacterId: characterId,
    itemId: input.itemId,
    itemName: input.itemName,
    alertOnMargin: input.alertOnMargin ?? null,
    alertOnBuyPrice: input.alertOnBuyPrice ?? null,
    alertOnSellPrice: input.alertOnSellPrice ?? null,
    alertOnVolume: input.alertOnVolume ?? null,
    notes: input.notes ?? null,
    isActive: true,
  };

  const [watchItem] = await db
    .insert(geWatchItems)
    .values(watchData)
    .onConflictDoUpdate({
      target: [geWatchItems.userCharacterId, geWatchItems.itemId],
      set: {
        alertOnMargin: input.alertOnMargin ?? null,
        alertOnBuyPrice: input.alertOnBuyPrice ?? null,
        alertOnSellPrice: input.alertOnSellPrice ?? null,
        alertOnVolume: input.alertOnVolume ?? null,
        notes: input.notes ?? null,
        isActive: true,
        updatedAt: new Date(),
      },
    })
    .returning();

  if (!watchItem) {
    throw new Error('Failed to add watch item');
  }

  logger.info({ characterId, itemId: input.itemId }, 'Added watch item');
  return watchItem;
}

/**
 * Get watch list for a character
 */
export async function getWatchList(
  characterId: string,
  activeOnly: boolean = true
): Promise<GeWatchItem[]> {
  const db = getDbClient();

  const conditions = [eq(geWatchItems.userCharacterId, characterId)];
  if (activeOnly) {
    conditions.push(eq(geWatchItems.isActive, true));
  }

  return db
    .select()
    .from(geWatchItems)
    .where(and(...conditions))
    .orderBy(asc(geWatchItems.itemName));
}

/**
 * Update a watch item
 */
export async function updateWatchItem(
  characterId: string,
  watchItemId: string,
  updates: {
    alertOnMargin?: number | null | undefined;
    alertOnBuyPrice?: number | null | undefined;
    alertOnSellPrice?: number | null | undefined;
    alertOnVolume?: number | null | undefined;
    isActive?: boolean | undefined;
    notes?: string | null | undefined;
  }
): Promise<GeWatchItem | null> {
  const db = getDbClient();

  const [updated] = await db
    .update(geWatchItems)
    .set({
      ...(updates.alertOnMargin !== undefined && {
        alertOnMargin: updates.alertOnMargin,
      }),
      ...(updates.alertOnBuyPrice !== undefined && {
        alertOnBuyPrice: updates.alertOnBuyPrice,
      }),
      ...(updates.alertOnSellPrice !== undefined && {
        alertOnSellPrice: updates.alertOnSellPrice,
      }),
      ...(updates.alertOnVolume !== undefined && {
        alertOnVolume: updates.alertOnVolume,
      }),
      ...(updates.isActive !== undefined && { isActive: updates.isActive }),
      ...(updates.notes !== undefined && { notes: updates.notes }),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(geWatchItems.id, watchItemId),
        eq(geWatchItems.userCharacterId, characterId)
      )
    )
    .returning();

  return updated ?? null;
}

/**
 * Remove an item from the watch list
 */
export async function removeWatchItem(
  characterId: string,
  watchItemId: string
): Promise<boolean> {
  const db = getDbClient();

  const result = await db
    .delete(geWatchItems)
    .where(
      and(
        eq(geWatchItems.id, watchItemId),
        eq(geWatchItems.userCharacterId, characterId)
      )
    )
    .returning({ id: geWatchItems.id });

  return result.length > 0;
}
