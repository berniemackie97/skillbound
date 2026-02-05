import {
  boolean,
  integer,
  jsonb,
  pgTable,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { userCharacters } from '../characters/characters';

import { users } from './users';

/**
 * Per-user settings (preferences + default character selection)
 */
export const userSettings = pgTable('user_settings', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  activeCharacterId: uuid('active_character_id').references(
    () => userCharacters.id,
    {
      onDelete: 'set null',
    }
  ),
  characterSyncEnabled: boolean('character_sync_enabled')
    .notNull()
    .default(true),
  characterSyncIntervalHours: integer('character_sync_interval_hours')
    .notNull()
    .default(24),
  gePresets: jsonb('ge_presets').$type<unknown[]>().default([]),
  geRefreshIntervalMs: integer('ge_refresh_interval_ms')
    .notNull()
    .default(45000),
  geRefreshPaused: boolean('ge_refresh_paused').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type UserSettings = typeof userSettings.$inferSelect;
export type NewUserSettings = typeof userSettings.$inferInsert;
