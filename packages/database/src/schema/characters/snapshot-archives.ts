import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

import { characterProfiles } from './characters';
import { snapshotRetentionTierEnum } from './snapshots';

/**
 * Snapshot archives table
 * Tracks archived snapshot batches stored in object storage.
 */
export const snapshotArchives = pgTable(
  'snapshot_archives',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => characterProfiles.id, { onDelete: 'cascade' }),

    sourceTier: snapshotRetentionTierEnum('source_tier').notNull(),
    targetTier: snapshotRetentionTierEnum('target_tier'),
    reason: text('reason').notNull(), // promotion | expiration | manual
    bucketKey: text('bucket_key').notNull(),

    capturedFrom: timestamp('captured_from', { withTimezone: true }).notNull(),
    capturedTo: timestamp('captured_to', { withTimezone: true }).notNull(),
    snapshotCount: integer('snapshot_count').notNull(),

    storageProvider: text('storage_provider').notNull(), // s3
    storageBucket: text('storage_bucket').notNull(),
    storageKey: text('storage_key').notNull(),
    storageRegion: text('storage_region'),
    storageEndpoint: text('storage_endpoint'),
    checksum: text('checksum').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    compressed: boolean('compressed').notNull().default(true),
    archiveVersion: integer('archive_version').notNull().default(1),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    archiveUnique: unique(
      'snapshot_archives_profile_source_reason_bucket_unique'
    ).on(table.profileId, table.sourceTier, table.reason, table.bucketKey),
    profileIdx: index('snapshot_archives_profile_idx').on(table.profileId),
    sourceTierIdx: index('snapshot_archives_source_tier_idx').on(
      table.sourceTier
    ),
    bucketIdx: index('snapshot_archives_bucket_idx').on(table.bucketKey),
    createdAtIdx: index('snapshot_archives_created_at_idx').on(table.createdAt),
  })
);

export type SnapshotArchive = typeof snapshotArchives.$inferSelect;
export type NewSnapshotArchive = typeof snapshotArchives.$inferInsert;
