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
 * Character state domain enum
 * Categorizes different types of character progress/state
 */
export const characterStateDomainEnum = pgEnum('character_state_domain', [
  // Core progress from hiscores/RuneLite
  'skill', // Skill XP and levels
  'boss', // Boss killcounts and PBs
  'activity', // Minigame scores, clue counts, etc.

  // Quest and diary completion
  'quest', // Quest completion status
  'diary', // Achievement diary completion
  'diary_task', // Individual diary task completion
  'combat_achievement', // Combat achievement completion

  // Collection and items
  'collection_log', // Collection log item obtained
  'item_unlock', // Unlocked items (fairy rings, spirit trees, etc.)
  'gear', // Gear obtained/equipped

  // Guide and progression tracking
  'guide_step', // Guide step completion
  'milestone', // Custom milestone achievement
  'goal', // User-defined goals

  // Manual overrides and flags
  'unlock_flag', // Manual unlock flags (e.g., "fairy_rings_unlocked")
  'custom', // Custom user-defined state
]);

/**
 * Character state source enum
 * Tracks where the state data originated from
 */
export const characterStateSourceEnum = pgEnum('character_state_source', [
  'hiscores', // Official OSRS hiscores
  'runelite', // RuneLite plugin sync
  'wiki', // Wiki data import
  'guide', // Set from guide completion
  'manual', // User manually set
  'calculated', // Derived/calculated from other state
  'migration', // Migrated from legacy tables
]);

/**
 * Unified character state table
 *
 * This table provides a single source of truth for ALL character progress,
 * enabling efficient cross-feature queries and consistent state management.
 *
 * Design principles:
 * - One row per character/domain/key combination
 * - JSONB value allows flexible data storage per domain
 * - Source tracking enables conflict resolution
 * - Timestamps support historical tracking
 *
 * Example rows:
 * - domain='skill', key='attack', value={level: 99, xp: 13034431, rank: 12345}
 * - domain='quest', key='dragon_slayer', value={completed: true, completedAt: '...'}
 * - domain='boss', key='zulrah', value={kc: 500, pb: 52}
 * - domain='unlock_flag', key='fairy_rings', value={unlocked: true}
 */
export const characterState = pgTable(
  'character_state',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Character reference
    userCharacterId: uuid('user_character_id')
      .notNull()
      .references(() => userCharacters.id, { onDelete: 'cascade' }),

    // State categorization
    domain: characterStateDomainEnum('domain').notNull(),
    key: text('key').notNull(), // e.g., 'attack', 'dragon_slayer', 'zulrah'

    // Flexible value storage - structure depends on domain
    value: jsonb('value').notNull(),

    // Data provenance
    source: characterStateSourceEnum('source').notNull().default('manual'),
    sourceId: text('source_id'), // Optional reference (guide ID, sync job ID, etc.)

    // Confidence/priority for conflict resolution (higher = more authoritative)
    // RuneLite data > hiscores > manual > calculated
    confidence: text('confidence').$type<'high' | 'medium' | 'low'>().default('medium'),

    // User note (for manual entries)
    note: text('note'),

    // Timestamps
    achievedAt: timestamp('achieved_at', { withTimezone: true }), // When the state was achieved in-game
    syncedAt: timestamp('synced_at', { withTimezone: true }), // Last sync from external source
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    // UNIQUE CONSTRAINT: One state entry per character/domain/key
    // This is the core constraint enabling upsert operations
    characterDomainKeyUnique: unique('character_state_char_domain_key_unique').on(
      table.userCharacterId,
      table.domain,
      table.key
    ),

    // Primary query: Get all state for a character in a domain
    characterDomainIdx: index('character_state_char_domain_idx').on(
      table.userCharacterId,
      table.domain
    ),

    // Get all state for a character (dashboard view)
    characterIdIdx: index('character_state_character_id_idx').on(
      table.userCharacterId
    ),

    // Filter by source (e.g., find all RuneLite-synced state)
    sourceIdx: index('character_state_source_idx').on(table.source),

    // Find state by domain globally (analytics, leaderboards)
    domainKeyIdx: index('character_state_domain_key_idx').on(
      table.domain,
      table.key
    ),

    // Recent updates (activity feed)
    updatedAtIdx: index('character_state_updated_at_idx').on(table.updatedAt),

    // Achievement timeline
    characterAchievedAtIdx: index('character_state_char_achieved_at_idx').on(
      table.userCharacterId,
      table.achievedAt
    ),
  })
);

/**
 * Type definitions for different domain values
 */
export interface SkillStateValue {
  level: number;
  xp: number;
  rank?: number | null;
  virtualLevel?: number; // For 99+ tracking
}

export interface BossStateValue {
  kc: number;
  pb?: number | null; // Personal best time in game ticks
  pbFormatted?: string; // "1:23.4"
}

export interface QuestStateValue {
  completed: boolean;
  completedAt?: string;
  state?: 'not_started' | 'in_progress' | 'completed'; // RuneLite quest state
}

export interface DiaryStateValue {
  completed: boolean;
  completedAt?: string;
  tasksCompleted?: number;
  totalTasks?: number;
}

export interface UnlockFlagValue {
  unlocked: boolean;
  unlockedAt?: string;
  source?: string; // How it was unlocked (quest, achievement, etc.)
}

export interface CollectionLogValue {
  obtained: boolean;
  obtainedAt?: string;
  killcount?: number; // KC when obtained
  source?: string; // Boss/activity that dropped it
}

export interface GuideStepValue {
  completed: boolean;
  completedAt?: string;
  readyItems?: string[]; // Items marked as ready
  readyInstructions?: number[]; // Instructions marked as done
}

// Union type for all possible values
export type CharacterStateValue =
  | SkillStateValue
  | BossStateValue
  | QuestStateValue
  | DiaryStateValue
  | UnlockFlagValue
  | CollectionLogValue
  | GuideStepValue
  | Record<string, unknown>; // Fallback for custom domains

export type CharacterState = typeof characterState.$inferSelect;
export type NewCharacterState = typeof characterState.$inferInsert;
