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

import { progressionCategories } from './progression';

/**
 * Game stage enum for gear progression
 */
export const gameStageEnum = pgEnum('game_stage', [
  'early',
  'mid',
  'late',
  'end',
  'specialized',
]);

/**
 * Difficulty tier enum
 */
export const difficultyTierEnum = pgEnum('difficulty_tier', [
  'easy',
  'medium',
  'hard',
  'elite',
  'master',
]);

/**
 * Boss killcount tracking
 */
export const bossKillcounts = pgTable(
  'boss_killcounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userCharacterId: uuid('user_character_id')
      .notNull()
      .references(() => userCharacters.id, { onDelete: 'cascade' }),
    bossName: text('boss_name').notNull(),
    killcount: integer('killcount').notNull().default(0),
    personalBest: integer('personal_best'), // Time in seconds for speedrun bosses
    lastUpdated: timestamp('last_updated', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    // UNIQUE CONSTRAINT: One killcount entry per character/boss combination
    // Required for upsert operations when syncing from RuneLite/hiscores
    characterBossUnique: unique('boss_kc_character_boss_unique').on(
      table.userCharacterId,
      table.bossName
    ),
    // Index for querying all bosses for a character
    characterIdIdx: index('boss_kc_character_id_idx').on(
      table.userCharacterId
    ),
    // Index for leaderboard queries by boss
    bossNameIdx: index('boss_kc_boss_name_idx').on(table.bossName),
  })
);

/**
 * Collection log items tracking
 */
export const collectionLogItems = pgTable(
  'collection_log_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userCharacterId: uuid('user_character_id')
      .notNull()
      .references(() => userCharacters.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id').references(() => progressionCategories.id, {
      onDelete: 'set null',
    }),
    itemName: text('item_name').notNull(),
    itemId: integer('item_id'),
    source: text('source').notNull(), // Boss name, activity, etc.
    obtained: boolean('obtained').notNull().default(false),
    obtainedAt: timestamp('obtained_at', { withTimezone: true }),
    droprate: text('droprate'), // "1/128", "1/5000", etc.
    killcountWhenObtained: integer('killcount_when_obtained'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    // UNIQUE CONSTRAINT: One entry per character/item/source combination
    // Prevents duplicate collection log entries
    characterItemSourceUnique: unique('coll_log_character_item_source_unique').on(
      table.userCharacterId,
      table.itemId,
      table.source
    ),
    // Index for querying all items for a character
    characterIdIdx: index('coll_log_character_id_idx').on(
      table.userCharacterId
    ),
    // Index for filtering by source (boss drops, clue rewards, etc.)
    characterSourceIdx: index('coll_log_character_source_idx').on(
      table.userCharacterId,
      table.source
    ),
    // Index for filtering obtained/not obtained items
    characterObtainedIdx: index('coll_log_character_obtained_idx').on(
      table.userCharacterId,
      table.obtained
    ),
    // Index for item lookup across all characters (analytics)
    itemIdIdx: index('coll_log_item_id_idx').on(table.itemId),
  })
);

/**
 * Gear progression by game stage
 */
export const gearProgression = pgTable(
  'gear_progression',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userCharacterId: uuid('user_character_id')
      .notNull()
      .references(() => userCharacters.id, { onDelete: 'cascade' }),
    gameStage: gameStageEnum('game_stage').notNull(),
    slot: text('slot').notNull(), // "head", "body", "legs", "weapon", etc.
    itemName: text('item_name').notNull(),
    itemId: integer('item_id'),
    obtained: boolean('obtained').notNull().default(false),
    obtainedAt: timestamp('obtained_at', { withTimezone: true }),
    source: text('source'), // How to get it
    priority: integer('priority').notNull().default(0), // Higher = more important
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
    // UNIQUE CONSTRAINT: One gear item per character/stage/slot/item combination
    // Allows multiple items per slot (e.g., multiple weapons) while preventing duplicates
    characterStageSlotItemUnique: unique(
      'gear_prog_character_stage_slot_item_unique'
    ).on(table.userCharacterId, table.gameStage, table.slot, table.itemId),
    // Index for querying all gear for a character
    characterIdIdx: index('gear_prog_character_id_idx').on(
      table.userCharacterId
    ),
    // Index for filtering by game stage
    characterStageIdx: index('gear_prog_character_stage_idx').on(
      table.userCharacterId,
      table.gameStage
    ),
    // Index for filtering by slot (head, body, weapon, etc.)
    characterSlotIdx: index('gear_prog_character_slot_idx').on(
      table.userCharacterId,
      table.slot
    ),
    // Index for filtering obtained gear
    characterObtainedIdx: index('gear_prog_character_obtained_idx').on(
      table.userCharacterId,
      table.obtained
    ),
  })
);

/**
 * Goal/milestone tracking
 */
export const milestones = pgTable(
  'milestones',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userCharacterId: uuid('user_character_id')
      .notNull()
      .references(() => userCharacters.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id').references(() => progressionCategories.id, {
      onDelete: 'set null',
    }),
    difficulty: difficultyTierEnum('difficulty').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    requirements: jsonb('requirements').$type<
      Array<{
        type: 'skill' | 'quest' | 'item' | 'killcount' | 'custom';
        name: string;
        value: number | boolean;
      }>
    >(),
    achieved: boolean('achieved').notNull().default(false),
    achievedAt: timestamp('achieved_at', { withTimezone: true }),
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
    // UNIQUE CONSTRAINT: One milestone per character/name combination
    // Prevents duplicate milestone entries
    characterNameUnique: unique('milestones_character_name_unique').on(
      table.userCharacterId,
      table.name
    ),
    // Index for querying all milestones for a character
    characterIdIdx: index('milestones_character_id_idx').on(
      table.userCharacterId
    ),
    // Index for filtering by difficulty tier
    characterDifficultyIdx: index('milestones_character_difficulty_idx').on(
      table.userCharacterId,
      table.difficulty
    ),
    // Index for filtering achieved/not achieved milestones
    characterAchievedIdx: index('milestones_character_achieved_idx').on(
      table.userCharacterId,
      table.achieved
    ),
    // Index for category filtering
    categoryIdIdx: index('milestones_category_id_idx').on(table.categoryId),
  })
);

/**
 * Type exports
 */
export type BossKillcount = typeof bossKillcounts.$inferSelect;
export type NewBossKillcount = typeof bossKillcounts.$inferInsert;

export type CollectionLogItem = typeof collectionLogItems.$inferSelect;
export type NewCollectionLogItem = typeof collectionLogItems.$inferInsert;

export type GearProgressionItem = typeof gearProgression.$inferSelect;
export type NewGearProgressionItem = typeof gearProgression.$inferInsert;

export type Milestone = typeof milestones.$inferSelect;
export type NewMilestone = typeof milestones.$inferInsert;
