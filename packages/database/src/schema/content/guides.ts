import {
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
  type:
    | 'skill_level'
    | 'quest_complete'
    | 'diary_complete'
    | 'unlock_flag'
    | 'manual_check';
  data: Record<string, unknown>;
  optional?: boolean;
}

export interface GuideSection {
  id: string;
  title: string;
  description?: string;
  chapterTitle?: string;
}

/**
 * A single instruction within a guide step.
 * Instructions are atomic actions the player should take.
 */
export interface GuideInstruction {
  /** The instruction text describing what to do */
  text: string;
  /** Optional image URL for visual reference (e.g., map location screenshot) */
  imageUrl?: string;
  /** Optional alt text for the image for accessibility */
  imageAlt?: string;
  /** Optional link to open when clicking the image */
  imageLink?: string;
  /** Optional note or tip for this specific instruction */
  note?: string;
}

/**
 * A stat requirement for a guide step.
 */
export interface GuideStatRequirement {
  /** The skill name (e.g., "Firemaking", "Woodcutting") */
  skill: string;
  /** The required/after level */
  level: number;
  /** Optional icon identifier for the skill */
  icon?: string;
  /** Optional note about this stat requirement */
  note?: string;
}

export interface GuideStepMeta {
  gpStack?: {
    note?: string;
    min?: number;
    max?: number;
  };

  itemsNeeded: Array<{
    name: string;
    qty: number; // int > 0 by validation
    consumed?: boolean;
    note?: string;
    /** Optional icon identifier for the item */
    icon?: string;
  }>;

  /**
   * Stats section with required and after-completion stats
   */
  stats?: {
    /** Stats that must be met to complete the step */
    required: GuideStatRequirement[];
    /** Stats expected after completing the step */
    after: GuideStatRequirement[];
    /**
     * @deprecated Use stats.after instead
     */
    recommended?: GuideStatRequirement[];
  };

  /**
   * @deprecated Use stats.required instead
   */
  statsNeeded?: Array<{
    skill: string;
    level: number;
    note?: string;
  }>;

  alternativeRoutes: Array<{
    title?: string;
    text: string;
  }>;
}

/**
 * Guide step structure
 */
export interface GuideStep {
  stepNumber: number;
  title: string;
  /**
   * Structured list of instructions for this step.
   * Each instruction is an atomic action with optional image support.
   */
  instructions: GuideInstruction[];
  requirements: GuideRequirement[];
  optionalRequirements?: GuideRequirement[];
  wikiLinks?: string[];
  calculatorLinks?: string[];
  tags?: string[];
  section?: GuideSection;
  meta?: GuideStepMeta;
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
    // UNIQUE CONSTRAINT: One version per title
    // Allows version bumps while preventing duplicate versions
    titleVersionUnique: unique('guide_templates_title_version_unique').on(
      table.title,
      table.version
    ),
    // Index for filtering by status (draft/published/deprecated)
    statusIdx: index('guide_templates_status_idx').on(table.status),
    // Index for ordering by publish date
    publishedAtIdx: index('guide_templates_published_at_idx').on(
      table.publishedAt
    ),
    // Index for searching by title
    titleIdx: index('guide_templates_title_idx').on(table.title),
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
    userCharacterId: uuid('user_character_id')
      .notNull()
      .references(() => userCharacters.id, { onDelete: 'cascade' }),
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
    // UNIQUE CONSTRAINT: One progress entry per character/guide/version
    // Prevents duplicate progress tracking
    characterGuideVersionUnique: unique(
      'guide_progress_character_guide_version_unique'
    ).on(table.userCharacterId, table.guideTemplateId, table.guideVersion),
    // Index for querying all guides for a character
    characterIdIdx: index('guide_progress_character_id_idx').on(
      table.userCharacterId
    ),
    // Index for querying all users following a guide
    guideTemplateIdIdx: index('guide_progress_guide_template_id_idx').on(
      table.guideTemplateId
    ),
    // Index for filtering completed guides
    completedAtIdx: index('guide_progress_completed_at_idx').on(
      table.completedAt
    ),
    // Index for recent activity
    updatedAtIdx: index('guide_progress_updated_at_idx').on(table.updatedAt),
  })
);

export type GuideTemplate = typeof guideTemplates.$inferSelect;
export type NewGuideTemplate = typeof guideTemplates.$inferInsert;
export type GuideProgress = typeof guideProgress.$inferSelect;
export type NewGuideProgress = typeof guideProgress.$inferInsert;
