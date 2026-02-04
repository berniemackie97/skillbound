import {
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  unique,
} from 'drizzle-orm/pg-core';

import { users } from '../auth/users';

/**
 * Account mode enum
 */
export const accountModeEnum = pgEnum('account_mode', [
  'normal',
  'ironman',
  'hardcore',
  'ultimate',
  'group-ironman',
  'hardcore-group-ironman',
  'unranked-group-ironman',
]);

/**
 * Characters table
 * Stores OSRS characters tracked by users
 */
export const characterProfiles = pgTable(
  'character_profiles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    displayName: text('display_name').notNull(),
    mode: accountModeEnum('mode').notNull().default('normal'),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    womBackfillCheckedAt: timestamp('wom_backfill_checked_at', {
      withTimezone: true,
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    displayNameIdx: index('character_profiles_display_name_idx').on(
      table.displayName
    ),
    displayNameModeUnique: unique(
      'character_profiles_display_name_mode_unique'
    ).on(table.displayName, table.mode),
    lastSyncedAtIdx: index('character_profiles_last_synced_at_idx').on(
      table.lastSyncedAt
    ),
  })
);

export const userCharacters = pgTable(
  'user_characters',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => characterProfiles.id, { onDelete: 'cascade' }),
    tags: jsonb('tags').$type<string[]>().default([]),
    notes: text('notes'),
    isPublic: boolean('is_public').notNull().default(false),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    userIdIdx: index('user_characters_user_id_idx').on(table.userId),
    profileIdIdx: index('user_characters_profile_id_idx').on(table.profileId),
    isPublicIdx: index('user_characters_is_public_idx').on(table.isPublic),
    archivedAtIdx: index('user_characters_archived_at_idx').on(table.archivedAt),
    userProfileUnique: unique('user_characters_user_profile_unique').on(
      table.userId,
      table.profileId
    ),
  })
);

export type CharacterProfile = typeof characterProfiles.$inferSelect;
export type NewCharacterProfile = typeof characterProfiles.$inferInsert;
export type UserCharacter = typeof userCharacters.$inferSelect;
export type NewUserCharacter = typeof userCharacters.$inferInsert;
