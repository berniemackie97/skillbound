/**
 * Price Alerts Service
 *
 * Checks watch item thresholds against current market data and generates
 * alerts when conditions are met. Alerts are persisted for UI display
 * and optional delivery via email or web push notifications.
 *
 * Alert types:
 *   - price-below: Buy price dropped below threshold
 *   - price-above: Sell price rose above threshold
 *   - margin-threshold: Margin exceeded configured threshold
 *   - volume-spike: Daily volume exceeded threshold
 *   - quality-change: Flip quality grade changed significantly
 *   - investment-opportunity: Investment signal detected for watched item
 */

import {
  and,
  desc,
  eq,
  geAlerts,
  geWatchItems,
  sql,
  type GeAlert,
  type GeWatchItem,
  type NewGeAlert,
} from '@skillbound/database';

import { getDbClient } from '../db';

import type { GeExchangeItem } from './ge-service';

// ---------------------------------------------------------------------------
// Alert checking
// ---------------------------------------------------------------------------

export interface AlertCheckResult {
  watchItem: GeWatchItem;
  alerts: NewGeAlert[];
}

/**
 * Check a single watch item against current market data.
 * Returns any alerts that should be triggered.
 */
export function checkWatchItemThresholds(
  watchItem: GeWatchItem,
  item: GeExchangeItem
): NewGeAlert[] {
  const alerts: NewGeAlert[] = [];

  // Price below threshold (good time to buy)
  if (
    watchItem.alertOnBuyPrice !== null &&
    item.buyPrice !== null &&
    item.buyPrice <= watchItem.alertOnBuyPrice
  ) {
    alerts.push({
      userCharacterId: watchItem.userCharacterId,
      itemId: watchItem.itemId,
      itemName: watchItem.itemName,
      alertType: 'price-below',
      title: `${watchItem.itemName} price dropped`,
      message: `Buy price is ${item.buyPrice.toLocaleString()} gp (below your ${watchItem.alertOnBuyPrice.toLocaleString()} gp threshold).`,
      triggerValue: item.buyPrice,
      thresholdValue: watchItem.alertOnBuyPrice,
    });
  }

  // Price above threshold (good time to sell)
  if (
    watchItem.alertOnSellPrice !== null &&
    item.sellPrice !== null &&
    item.sellPrice >= watchItem.alertOnSellPrice
  ) {
    alerts.push({
      userCharacterId: watchItem.userCharacterId,
      itemId: watchItem.itemId,
      itemName: watchItem.itemName,
      alertType: 'price-above',
      title: `${watchItem.itemName} price rose`,
      message: `Sell price is ${item.sellPrice.toLocaleString()} gp (above your ${watchItem.alertOnSellPrice.toLocaleString()} gp threshold).`,
      triggerValue: item.sellPrice,
      thresholdValue: watchItem.alertOnSellPrice,
    });
  }

  // Margin threshold
  if (
    watchItem.alertOnMargin !== null &&
    item.margin !== null &&
    item.margin >= watchItem.alertOnMargin
  ) {
    alerts.push({
      userCharacterId: watchItem.userCharacterId,
      itemId: watchItem.itemId,
      itemName: watchItem.itemName,
      alertType: 'margin-threshold',
      title: `${watchItem.itemName} margin opportunity`,
      message: `Margin is ${item.margin.toLocaleString()} gp (above your ${watchItem.alertOnMargin.toLocaleString()} gp threshold).`,
      triggerValue: item.margin,
      thresholdValue: watchItem.alertOnMargin,
    });
  }

  // Volume spike
  if (
    watchItem.alertOnVolume !== null &&
    item.volume !== null &&
    item.volume * 24 >= watchItem.alertOnVolume
  ) {
    const estDailyVolume = item.volume * 24;
    alerts.push({
      userCharacterId: watchItem.userCharacterId,
      itemId: watchItem.itemId,
      itemName: watchItem.itemName,
      alertType: 'volume-spike',
      title: `${watchItem.itemName} volume spike`,
      message: `Estimated daily volume is ${estDailyVolume.toLocaleString()} (above your ${watchItem.alertOnVolume.toLocaleString()} threshold).`,
      triggerValue: estDailyVolume,
      thresholdValue: watchItem.alertOnVolume,
    });
  }

  return alerts;
}

// ---------------------------------------------------------------------------
// Batch checking
// ---------------------------------------------------------------------------

/**
 * Check all active watch items for a character against current prices.
 * Respects a cooldown — won't re-alert within the cooldown window.
 */
export async function checkAlertsForCharacter(
  userCharacterId: string,
  items: Map<number, GeExchangeItem>,
  cooldownMs: number = 4 * 60 * 60 * 1000 // 4 hours default
): Promise<NewGeAlert[]> {
  const db = getDbClient();

  const watchItems = await db
    .select()
    .from(geWatchItems)
    .where(
      and(
        eq(geWatchItems.userCharacterId, userCharacterId),
        eq(geWatchItems.isActive, true)
      )
    );

  const allAlerts: NewGeAlert[] = [];
  const now = Date.now();

  for (const watchItem of watchItems) {
    // Skip if recently alerted
    if (
      watchItem.lastAlertedAt &&
      now - watchItem.lastAlertedAt.getTime() < cooldownMs
    ) {
      continue;
    }

    const item = items.get(watchItem.itemId);
    if (!item) continue;

    const alerts = checkWatchItemThresholds(watchItem, item);
    if (alerts.length > 0) {
      allAlerts.push(...alerts);

      // Update lastAlertedAt
      await db
        .update(geWatchItems)
        .set({ lastAlertedAt: new Date() })
        .where(eq(geWatchItems.id, watchItem.id));
    }
  }

  return allAlerts;
}

// ---------------------------------------------------------------------------
// Alert persistence
// ---------------------------------------------------------------------------

/**
 * Persist alerts to the database.
 */
export async function saveAlerts(alerts: NewGeAlert[]): Promise<number> {
  if (alerts.length === 0) return 0;

  const db = getDbClient();
  const inserted = await db.insert(geAlerts).values(alerts).returning();
  return inserted.length;
}

/**
 * Get unread alerts for a character.
 */
export async function getUnreadAlerts(
  userCharacterId: string,
  limit: number = 50
): Promise<GeAlert[]> {
  const db = getDbClient();

  return db
    .select()
    .from(geAlerts)
    .where(
      and(
        eq(geAlerts.userCharacterId, userCharacterId),
        eq(geAlerts.isRead, false)
      )
    )
    .orderBy(desc(geAlerts.createdAt))
    .limit(limit);
}

/**
 * Mark alerts as read.
 */
export async function markAlertsRead(alertIds: string[]): Promise<void> {
  if (alertIds.length === 0) return;

  const db = getDbClient();

  await db
    .update(geAlerts)
    .set({ isRead: true })
    .where(sql`${geAlerts.id} = ANY(${alertIds})`);
}

/**
 * Mark all alerts as read for a character.
 */
export async function markAllAlertsRead(
  userCharacterId: string
): Promise<void> {
  const db = getDbClient();

  await db
    .update(geAlerts)
    .set({ isRead: true })
    .where(
      and(
        eq(geAlerts.userCharacterId, userCharacterId),
        eq(geAlerts.isRead, false)
      )
    );
}

/**
 * Count unread alerts for a character.
 */
export async function countUnreadAlerts(
  userCharacterId: string
): Promise<number> {
  const db = getDbClient();

  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(geAlerts)
    .where(
      and(
        eq(geAlerts.userCharacterId, userCharacterId),
        eq(geAlerts.isRead, false)
      )
    );

  return result?.count ?? 0;
}

/**
 * Prune old read alerts (keep last 30 days).
 */
export async function pruneOldAlerts(
  maxAgeMs: number = 30 * 24 * 60 * 60 * 1000
): Promise<number> {
  const db = getDbClient();
  const cutoff = new Date(Date.now() - maxAgeMs);

  const deleted = await db
    .delete(geAlerts)
    .where(
      and(eq(geAlerts.isRead, true), sql`${geAlerts.createdAt} < ${cutoff}`)
    )
    .returning({ id: geAlerts.id });

  return deleted.length;
}
