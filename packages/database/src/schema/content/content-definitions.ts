import { relations } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Quest definitions from OSRS Wiki
 * Source of truth for all quest metadata
 */
export const questDefinitions = pgTable(
  'quest_definitions',
  {
    id: text('id').primaryKey(), // Normalized ID (e.g., "cook_s_assistant")
    name: text('name').notNull(), // Display name (e.g., "Cook's Assistant")
    difficulty: text('difficulty'), // Novice, Intermediate, Experienced, Master, Grandmaster
    length: text('length'), // Very Short, Short, Medium, Long, Very Long
    description: text('description'), // Quest description
    questPoints: integer('quest_points'), // Quest points awarded
    requirements: jsonb('requirements').$type<unknown[]>().default([]),
    optionalRequirements: jsonb('optional_requirements').$type<unknown[]>(),
    wikiUrl: text('wiki_url'),
    wikiRevisionId: text('wiki_revision_id'), // For tracking changes
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    updatedAtIdx: index('quest_defs_updated_at_idx').on(table.updatedAt),
    wikiRevisionIdx: index('quest_defs_wiki_revision_idx').on(
      table.wikiRevisionId
    ),
  })
);

/**
 * Achievement diary regions
 */
export const diaryDefinitions = pgTable(
  'diary_definitions',
  {
    id: text('id').primaryKey(), // Normalized ID (e.g., "ardougne")
    name: text('name').notNull(), // Display name (e.g., "Ardougne Diary")
    region: text('region').notNull(), // Region name
    wikiUrl: text('wiki_url'),
    wikiRevisionId: text('wiki_revision_id'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    updatedAtIdx: index('diary_defs_updated_at_idx').on(table.updatedAt),
  })
);

/**
 * Achievement diary tiers (Easy, Medium, Hard, Elite)
 */
export const diaryTierDefinitions = pgTable(
  'diary_tier_definitions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    diaryId: text('diary_id')
      .notNull()
      .references(() => diaryDefinitions.id, { onDelete: 'cascade' }),
    tier: text('tier').notNull(), // "easy", "medium", "hard", "elite"
    name: text('name'), // Display name (e.g., "Easy")
    requirements: jsonb('requirements').$type<unknown[]>().default([]),
    optionalRequirements: jsonb('optional_requirements').$type<unknown[]>(),
    wikiUrl: text('wiki_url'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    diaryIdIdx: index('diary_tier_defs_diary_id_idx').on(table.diaryId),
    uniqueDiaryTier: unique('diary_tier_defs_diary_tier_unique').on(
      table.diaryId,
      table.tier
    ),
  })
);

/**
 * Individual achievement diary tasks
 * task_order is critical: it maps to RuneLite's task array index
 */
export const diaryTaskDefinitions = pgTable(
  'diary_task_definitions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tierId: uuid('tier_id')
      .notNull()
      .references(() => diaryTierDefinitions.id, { onDelete: 'cascade' }),
    taskId: text('task_id').notNull(), // Normalized task ID within tier
    taskOrder: integer('task_order').notNull(), // Position in tier (0-indexed, matches RuneLite)
    description: text('description').notNull(),
    requirements: jsonb('requirements').$type<unknown[]>().default([]),
    optionalRequirements: jsonb('optional_requirements').$type<unknown[]>(),
    wikiUrl: text('wiki_url'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    tierIdIdx: index('diary_task_defs_tier_id_idx').on(table.tierId),
    uniqueTierOrder: unique('diary_task_defs_tier_order_unique').on(
      table.tierId,
      table.taskOrder
    ),
  })
);

/**
 * Combat achievement definitions
 */
export const combatAchievementDefinitions = pgTable(
  'combat_achievement_definitions',
  {
    id: text('id').primaryKey(), // Normalized ID
    runeliteId: integer('runelite_id').unique(), // RuneLite numeric ID for mapping
    name: text('name').notNull(),
    description: text('description'), // The actual task description
    monster: text('monster'), // Boss/enemy name
    tier: text('tier'), // Difficulty tier (Easy, Medium, Hard, Elite, Master, Grandmaster)
    requirements: jsonb('requirements').$type<unknown[]>().default([]),
    optionalRequirements: jsonb('optional_requirements').$type<unknown[]>(),
    wikiUrl: text('wiki_url'),
    wikiRevisionId: text('wiki_revision_id'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    runeliteIdIdx: index('combat_achievement_defs_runelite_id_idx').on(
      table.runeliteId
    ),
    updatedAtIdx: index('combat_achievement_defs_updated_at_idx').on(
      table.updatedAt
    ),
  })
);

/**
 * Content sync job tracking
 */
export const contentSyncJobs = pgTable(
  'content_sync_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    contentType: text('content_type').notNull(), // "quests", "diaries", "combat_achievements"
    status: text('status').notNull().default('running'), // "running", "completed", "failed"
    startedAt: timestamp('started_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    recordsSynced: integer('records_synced').default(0),
    errorMessage: text('error_message'),
    metadata: jsonb('metadata').$type<{
      dryRun?: boolean;
      force?: boolean;
      recordsCreated?: number;
      recordsUpdated?: number;
      recordsDeleted?: number;
      errors?: string[];
    }>(),
  },
  (table) => ({
    contentTypeIdx: index('content_sync_jobs_content_type_idx').on(
      table.contentType
    ),
    statusIdx: index('content_sync_jobs_status_idx').on(table.status),
    startedAtIdx: index('content_sync_jobs_started_at_idx').on(table.startedAt),
  })
);

// Type exports
export type QuestDefinition = typeof questDefinitions.$inferSelect;
export type NewQuestDefinition = typeof questDefinitions.$inferInsert;

export type DiaryDefinition = typeof diaryDefinitions.$inferSelect;
export type NewDiaryDefinition = typeof diaryDefinitions.$inferInsert;

export type DiaryTierDefinition = typeof diaryTierDefinitions.$inferSelect;
export type NewDiaryTierDefinition = typeof diaryTierDefinitions.$inferInsert;

export type DiaryTaskDefinition = typeof diaryTaskDefinitions.$inferSelect;
export type NewDiaryTaskDefinition = typeof diaryTaskDefinitions.$inferInsert;

export type CombatAchievementDefinition =
  typeof combatAchievementDefinitions.$inferSelect;
export type NewCombatAchievementDefinition =
  typeof combatAchievementDefinitions.$inferInsert;

export type ContentSyncJob = typeof contentSyncJobs.$inferSelect;
export type NewContentSyncJob = typeof contentSyncJobs.$inferInsert;

// Relations
export const diaryDefinitionsRelations = relations(
  diaryDefinitions,
  ({ many }) => ({
    tiers: many(diaryTierDefinitions),
  })
);

export const diaryTierDefinitionsRelations = relations(
  diaryTierDefinitions,
  ({ one, many }) => ({
    diary: one(diaryDefinitions, {
      fields: [diaryTierDefinitions.diaryId],
      references: [diaryDefinitions.id],
    }),
    tasks: many(diaryTaskDefinitions),
  })
);

export const diaryTaskDefinitionsRelations = relations(
  diaryTaskDefinitions,
  ({ one }) => ({
    tier: one(diaryTierDefinitions, {
      fields: [diaryTaskDefinitions.tierId],
      references: [diaryTierDefinitions.id],
    }),
  })
);
