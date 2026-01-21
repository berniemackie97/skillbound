import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { characters } from './characters';

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
    characterId: uuid('character_id')
      .notNull()
      .references(() => characters.id, { onDelete: 'cascade' }),
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
    characterIdIdx: index('overrides_character_id_idx').on(table.characterId),
    typeKeyIdx: index('overrides_type_key_idx').on(table.type, table.key),
    characterTypeKeyIdx: index('overrides_character_type_key_idx').on(
      table.characterId,
      table.type,
      table.key
    ),
  })
);

export type CharacterOverride = typeof characterOverrides.$inferSelect;
export type NewCharacterOverride = typeof characterOverrides.$inferInsert;
