import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

import { userCharacters } from './characters';

/**
 * Override type enum
 */
export const overrideTypeEnum = pgEnum('override_type', [
  'quest_complete',
  'diary_complete',
  'diary_task_complete',
  'unlock_flag',
  'item_possessed',
  'combat_achievement',
]);

/**
 * Character overrides table
 * Stores manual data that cannot be inferred from hiscores
 */
export const characterOverrides = pgTable(
  'character_overrides',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userCharacterId: uuid('user_character_id')
      .notNull()
      .references(() => userCharacters.id, { onDelete: 'cascade' }),
    type: overrideTypeEnum('type').notNull(),
    key: text('key').notNull(), // e.g., "quest:dragon_slayer" or "diary:lumbridge_easy"
    value: jsonb('value').notNull(), // Flexible value storage (boolean, number, object)
    note: text('note'), // Optional user note
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    // UNIQUE CONSTRAINT: Required for upsert operations (onConflictDoUpdate)
    // Ensures one override per character/type/key combination
    characterTypeKeyUnique: unique('overrides_character_type_key_unique').on(
      table.userCharacterId,
      table.type,
      table.key
    ),
    // Index for querying all overrides of a specific type for a character
    characterTypeIdx: index('overrides_character_type_idx').on(
      table.userCharacterId,
      table.type
    ),
    // Index for querying by type globally (admin/analytics)
    typeIdx: index('overrides_type_idx').on(table.type),
  })
);

export type CharacterOverride = typeof characterOverrides.$inferSelect;
export type NewCharacterOverride = typeof characterOverrides.$inferInsert;
