import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

import { userCharacters } from '../characters/characters';

/**
 * Progression item type enum
 */
export const progressionItemTypeEnum = pgEnum('progression_item_type', [
  'unlock',
  'item',
  'gear',
  'goal',
  'custom',
]);

/**
 * Progression categories table
 * Defines categories of progression items (e.g., "Essential Gear", "Major Unlocks")
 */
export const progressionCategories = pgTable(
  'progression_categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    description: text('description'),
    icon: text('icon'), // emoji or icon name
    orderIndex: integer('order_index').notNull().default(0),
    defaultItems: jsonb('default_items')
      .$type<ProgressionItemTemplate[]>()
      .default([]),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    // UNIQUE CONSTRAINT: Category names must be unique
    nameUnique: unique('progression_categories_name_unique').on(table.name),
    // Index for ordering categories
    orderIndexIdx: index('progression_categories_order_idx').on(table.orderIndex),
  })
);

/**
 * Character progression items table
 * Tracks user's custom progression checklist
 */
export const characterProgressionItems = pgTable(
  'character_progression_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userCharacterId: uuid('user_character_id')
      .notNull()
      .references(() => userCharacters.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id').references(() => progressionCategories.id, {
      onDelete: 'set null',
    }),
    itemType: progressionItemTypeEnum('item_type').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    itemId: integer('item_id'), // For game items
    unlockFlag: text('unlock_flag'), // For unlock flags
    completed: boolean('completed').notNull().default(false),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    notes: text('notes'),
    orderIndex: integer('order_index').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    // UNIQUE CONSTRAINT: One item per character/category/name combination
    // Prevents duplicate items in the same category
    characterCategoryNameUnique: unique(
      'progression_items_char_cat_name_unique'
    ).on(table.userCharacterId, table.categoryId, table.name),
    // Index for querying all items for a character
    characterIdIdx: index('progression_items_character_id_idx').on(
      table.userCharacterId
    ),
    // Index for filtering completed/incomplete items
    characterIdCompletedIdx: index(
      'progression_items_character_completed_idx'
    ).on(table.userCharacterId, table.completed),
    // Index for category filtering
    categoryIdIdx: index('progression_items_category_id_idx').on(
      table.categoryId
    ),
    // Index for item type filtering
    characterItemTypeIdx: index('progression_items_char_type_idx').on(
      table.userCharacterId,
      table.itemType
    ),
    // Index for ordering items
    characterOrderIdx: index('progression_items_char_order_idx').on(
      table.userCharacterId,
      table.orderIndex
    ),
    // Index for unlock flag lookups
    unlockFlagIdx: index('progression_items_unlock_flag_idx').on(
      table.unlockFlag
    ),
  })
);

/**
 * Type definitions
 */
export type ProgressionCategory = typeof progressionCategories.$inferSelect;
export type NewProgressionCategory = typeof progressionCategories.$inferInsert;
export type CharacterProgressionItem =
  typeof characterProgressionItems.$inferSelect;
export type NewCharacterProgressionItem =
  typeof characterProgressionItems.$inferInsert;

/**
 * Template structure for default items
 */
export interface ProgressionItemTemplate {
  name: string;
  description?: string;
  itemType: 'unlock' | 'item' | 'gear' | 'goal' | 'custom';
  itemId?: number;
  unlockFlag?: string;
  orderIndex?: number;
}
