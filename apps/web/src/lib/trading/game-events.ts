/**
 * Game Events Service
 *
 * Manages OSRS game update events that can impact market prices.
 * Events are used to:
 *   1. Annotate price charts with markers
 *   2. Correlate price movements with known causes
 *   3. Help users understand why prices changed
 *   4. Improve investment recommendations (e.g., skip items affected by nerfs)
 */

import {
  and,
  desc,
  eq,
  geGameEvents,
  gte,
  lte,
  sql,
  type GeGameEvent,
  type NewGeGameEvent,
} from '@skillbound/database';

import { getDbClient } from '../db';

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

/**
 * Insert a new game event.
 */
export async function createGameEvent(
  event: NewGeGameEvent
): Promise<GeGameEvent> {
  const db = getDbClient();
  const [created] = await db.insert(geGameEvents).values(event).returning();
  return created!;
}

/**
 * Get game events within a date range, ordered by most recent first.
 */
export async function getGameEvents(
  startDate: Date,
  endDate: Date = new Date()
): Promise<GeGameEvent[]> {
  const db = getDbClient();

  return db
    .select()
    .from(geGameEvents)
    .where(
      and(
        gte(geGameEvents.eventDate, startDate),
        lte(geGameEvents.eventDate, endDate)
      )
    )
    .orderBy(desc(geGameEvents.eventDate));
}

/**
 * Get game events that affected a specific item.
 */
export async function getEventsForItem(
  itemId: number,
  startDate?: Date
): Promise<GeGameEvent[]> {
  const db = getDbClient();

  const conditions = [
    sql`${geGameEvents.affectedItemIds} LIKE ${'%' + String(itemId) + '%'}`,
  ];
  if (startDate) {
    conditions.push(gte(geGameEvents.eventDate, startDate));
  }

  return db
    .select()
    .from(geGameEvents)
    .where(and(...conditions))
    .orderBy(desc(geGameEvents.eventDate));
}

/**
 * Get the most recent events (for a dashboard widget or alert).
 */
export async function getRecentEvents(
  limit: number = 10
): Promise<GeGameEvent[]> {
  const db = getDbClient();

  return db
    .select()
    .from(geGameEvents)
    .orderBy(desc(geGameEvents.eventDate))
    .limit(limit);
}

/**
 * Get events by type (e.g., all boss releases).
 */
export async function getEventsByType(
  eventType: GeGameEvent['eventType']
): Promise<GeGameEvent[]> {
  const db = getDbClient();

  return db
    .select()
    .from(geGameEvents)
    .where(eq(geGameEvents.eventType, eventType))
    .orderBy(desc(geGameEvents.eventDate));
}

/**
 * Delete a game event by ID.
 */
export async function deleteGameEvent(id: string): Promise<boolean> {
  const db = getDbClient();
  const deleted = await db
    .delete(geGameEvents)
    .where(eq(geGameEvents.id, id))
    .returning({ id: geGameEvents.id });
  return deleted.length > 0;
}
