import {
  bigint,
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { characters } from './characters';

/**
 * Skill snapshot data structure
 */
export interface SkillSnapshot {
  name: string;
  level: number;
  xp: number;
  rank: number | null;
}

/**
 * Character snapshots table
 * Stores historical progress data for characters
 */
export const characterSnapshots = pgTable(
  'character_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    characterId: uuid('character_id')
      .notNull()
      .references(() => characters.id, { onDelete: 'cascade' }),
    capturedAt: timestamp('captured_at', { withTimezone: true })
      .notNull()
      .defaultNow(),

    // Aggregate stats (denormalized for fast queries)
    totalLevel: integer('total_level').notNull(),
    totalXp: bigint('total_xp', { mode: 'number' }).notNull(),
    combatLevel: integer('combat_level').notNull(),

    // Full snapshot data
    skills: jsonb('skills').$type<SkillSnapshot[]>().notNull(),

    // Optional boss KC and activity data
    activities: jsonb('activities').$type<Record<string, number>>(),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    characterIdIdx: index('snapshots_character_id_idx').on(table.characterId),
    capturedAtIdx: index('snapshots_captured_at_idx').on(table.capturedAt),
    characterCapturedIdx: index('snapshots_character_captured_idx').on(
      table.characterId,
      table.capturedAt
    ),
  })
);

export type CharacterSnapshot = typeof characterSnapshots.$inferSelect;
export type NewCharacterSnapshot = typeof characterSnapshots.$inferInsert;
