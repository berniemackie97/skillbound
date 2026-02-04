import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { characterProfiles } from './characters';

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
 * Snapshot retention tier enum
 * Used for automatic retention policy management
 */
export const snapshotRetentionTierEnum = pgEnum('snapshot_retention_tier', [
  'realtime', // Keep for 24 hours (every sync)
  'hourly', // Keep for 7 days (hourly aggregates)
  'daily', // Keep for 90 days (daily aggregates)
  'weekly', // Keep for 1 year (weekly aggregates)
  'monthly', // Keep forever (monthly aggregates)
  'milestone', // Never delete (level ups, boss PBs, etc.)
]);

/**
 * Character snapshots table
 * Stores historical progress data for characters
 */
export const characterSnapshots = pgTable(
  'character_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => characterProfiles.id, { onDelete: 'cascade' }),
    capturedAt: timestamp('captured_at', { withTimezone: true })
      .notNull()
      .defaultNow(),

    // Data source tracking
    dataSource: text('data_source')
      .$type<'runelite' | 'hiscores'>()
      .notNull()
      .default('hiscores'),
    dataSourceWarning: text('data_source_warning'), // Warning if fallback was used

    // Aggregate stats (denormalized for fast queries)
    totalLevel: integer('total_level').notNull(),
    totalXp: bigint('total_xp', { mode: 'number' }).notNull(),
    combatLevel: integer('combat_level').notNull(),

    // Full snapshot data
    skills: jsonb('skills').$type<SkillSnapshot[]>().notNull(),

    // Optional boss KC and activity data
    activities: jsonb('activities').$type<Record<string, number>>(),

    // RuneLite-specific data (only present when dataSource === 'runelite')
    quests: jsonb('quests').$type<Record<string, number>>(), // Quest name -> 0|1|2
    achievementDiaries: jsonb('achievement_diaries').$type<
      Record<string, unknown>
    >(),
    musicTracks: jsonb('music_tracks').$type<Record<string, boolean>>(),
    combatAchievements: jsonb('combat_achievements').$type<number[]>(),
    collectionLog: jsonb('collection_log').$type<number[]>(),

    // Retention management fields
    retentionTier: snapshotRetentionTierEnum('retention_tier')
      .notNull()
      .default('realtime'),
    isMilestone: boolean('is_milestone').notNull().default(false),
    milestoneType: text('milestone_type'), // 'level_up', 'boss_pb', 'quest_complete', etc.
    milestoneData: jsonb('milestone_data').$type<{
      skill?: string;
      level?: number;
      boss?: string;
      time?: number;
      quest?: string;
    }>(),

    // Expiration for automatic cleanup (null = never expires)
    expiresAt: timestamp('expires_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    // Primary query pattern: character's snapshots ordered by time
    profileCapturedIdx: index('snapshots_profile_captured_idx').on(
      table.profileId,
      table.capturedAt
    ),
    // Index for retention policy cleanup jobs
    retentionTierIdx: index('snapshots_retention_tier_idx').on(
      table.retentionTier
    ),
    // Index for expired snapshot cleanup
    expiresAtIdx: index('snapshots_expires_at_idx').on(table.expiresAt),
    // Index for milestone snapshots (never deleted, special queries)
    profileMilestoneIdx: index('snapshots_profile_milestone_idx').on(
      table.profileId,
      table.isMilestone
    ),
    // Index for data source filtering
    dataSourceIdx: index('snapshots_data_source_idx').on(table.dataSource),
    // Composite index for efficient latest snapshot query
    profileCapturedDescIdx: index('snapshots_profile_captured_desc_idx').on(
      table.profileId,
      table.capturedAt
    ),
    // Index for total level leaderboards
    totalLevelIdx: index('snapshots_total_level_idx').on(table.totalLevel),
    // Index for total XP leaderboards
    totalXpIdx: index('snapshots_total_xp_idx').on(table.totalXp),
  })
);

export type CharacterSnapshot = typeof characterSnapshots.$inferSelect;
export type NewCharacterSnapshot = typeof characterSnapshots.$inferInsert;
