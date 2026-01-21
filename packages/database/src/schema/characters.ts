import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { users } from './users';

/**
 * Account mode enum
 */
export const accountModeEnum = pgEnum('account_mode', [
  'normal',
  'ironman',
  'hardcore-ironman',
  'ultimate-ironman',
]);

/**
 * Characters table
 * Stores OSRS characters tracked by users
 */
export const characters = pgTable(
  'characters',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    displayName: text('display_name').notNull(),
    mode: accountModeEnum('mode').notNull().default('normal'),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    tags: jsonb('tags').$type<string[]>().default([]),
    notes: text('notes'),
    isPublic: text('is_public').notNull().default('false'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    userIdIdx: index('characters_user_id_idx').on(table.userId),
    displayNameIdx: index('characters_display_name_idx').on(table.displayName),
  })
);

export type Character = typeof characters.$inferSelect;
export type NewCharacter = typeof characters.$inferInsert;
