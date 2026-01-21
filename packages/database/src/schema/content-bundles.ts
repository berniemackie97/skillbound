import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Content bundle status enum
 */
export const bundleStatusEnum = pgEnum('bundle_status', [
  'draft',
  'published',
  'deprecated',
]);

/**
 * Content bundles table
 * Stores versioned wiki-derived content (quests, diaries, items)
 */
export const contentBundles = pgTable(
  'content_bundles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    version: text('version').notNull().unique(),
    status: bundleStatusEnum('status').notNull().default('draft'),
    checksum: text('checksum').notNull(),
    storageUri: text('storage_uri').notNull(), // S3/R2 URI
    metadata: jsonb('metadata').$type<{
      sources: string[];
      generatedAt: string;
      questCount?: number;
      diaryCount?: number;
      itemCount?: number;
    }>(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    deprecatedAt: timestamp('deprecated_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    statusIdx: index('bundles_status_idx').on(table.status),
    publishedAtIdx: index('bundles_published_at_idx').on(table.publishedAt),
  })
);

export type ContentBundle = typeof contentBundles.$inferSelect;
export type NewContentBundle = typeof contentBundles.$inferInsert;
