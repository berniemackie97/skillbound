import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { characters } from './characters';

/**
 * Guide status enum
 */
export const guideStatusEnum = pgEnum('guide_status', [
  'draft',
  'published',
  'deprecated',
]);

/**
 * Guide requirement structure
 */
export interface GuideRequirement {
  type: 'skill_level' | 'quest_complete' | 'diary_complete' | 'unlock_flag';
  data: Record<string, unknown>;
  optional?: boolean;
}

/**
 * Guide step structure
 */
export interface GuideStep {
  stepNumber: number;
  title: string;
  description: string;
  requirements: GuideRequirement[];
  optionalRequirements?: GuideRequirement[];
  wikiLinks?: string[];
  calculatorLinks?: string[];
  tags?: string[];
}

/**
 * Guide templates table (admin-curated)
 * Stores progression guide templates
 */
export const guideTemplates = pgTable(
  'guide_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    version: integer('version').notNull().default(1),
    status: guideStatusEnum('status').notNull().default('draft'),
    recommendedModes: jsonb('recommended_modes')
      .$type<string[]>()
      .default(['normal']),
    tags: jsonb('tags').$type<string[]>().default([]),
    steps: jsonb('steps').$type<GuideStep[]>().notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    deprecatedAt: timestamp('deprecated_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    statusIdx: index('guide_templates_status_idx').on(table.status),
    publishedAtIdx: index('guide_templates_published_at_idx').on(
      table.publishedAt
    ),
  })
);

/**
 * Guide progress table (per character)
 * Tracks user progress through imported guides
 */
export const guideProgress = pgTable(
  'guide_progress',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    characterId: uuid('character_id')
      .notNull()
      .references(() => characters.id, { onDelete: 'cascade' }),
    guideTemplateId: uuid('guide_template_id')
      .notNull()
      .references(() => guideTemplates.id, { onDelete: 'cascade' }),
    guideVersion: integer('guide_version').notNull(),
    completedSteps: jsonb('completed_steps').$type<number[]>().default([]),
    currentStep: integer('current_step').notNull().default(0),
    startedAt: timestamp('started_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    characterIdIdx: index('guide_progress_character_id_idx').on(
      table.characterId
    ),
    guideTemplateIdIdx: index('guide_progress_guide_template_id_idx').on(
      table.guideTemplateId
    ),
  })
);

export type GuideTemplate = typeof guideTemplates.$inferSelect;
export type NewGuideTemplate = typeof guideTemplates.$inferInsert;
export type GuideProgress = typeof guideProgress.$inferSelect;
export type NewGuideProgress = typeof guideProgress.$inferInsert;
