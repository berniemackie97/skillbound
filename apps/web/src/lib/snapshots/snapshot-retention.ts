/**
 * Snapshot Retention Service
 *
 * Manages the lifecycle of character snapshots through retention tiers:
 * - realtime: Keep for 24 hours (every sync)
 * - hourly: Keep for 7 days (hourly aggregates)
 * - daily: Keep for 90 days (daily aggregates)
 * - weekly: Keep for 1 year (weekly aggregates)
 * - monthly: Keep forever (monthly aggregates)
 * - milestone: Never delete (level ups, boss PBs, etc.)
 *
 * The retention job:
 * 1. Promotes snapshots to higher tiers based on age
 * 2. Deletes expired snapshots
 * 3. Preserves milestone snapshots indefinitely
 */

import {
  and,
  characterSnapshots,
  eq,
  gt,
  isNotNull,
  lt,
  sql,
  type CharacterSnapshot,
} from '@skillbound/database';

import { getDbClient } from '../db';
import { logger } from '../logging/logger';

import { archiveSnapshotsBatch, getSnapshotArchivePolicy } from './snapshot-archives';

/**
 * Retention tier configuration
 */
export const RETENTION_CONFIG = {
  realtime: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    promoteTo: 'hourly' as const,
  },
  hourly: {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    promoteTo: 'daily' as const,
  },
  daily: {
    maxAge: 90 * 24 * 60 * 60 * 1000, // 90 days
    promoteTo: 'weekly' as const,
  },
  weekly: {
    maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
    promoteTo: 'monthly' as const,
  },
  monthly: {
    maxAge: null, // Keep forever
    promoteTo: null,
  },
  milestone: {
    maxAge: null, // Never delete
    promoteTo: null,
  },
} as const;

export type RetentionTier = keyof typeof RETENTION_CONFIG;

/**
 * Result of a retention job run
 */
export interface RetentionJobResult {
  success: boolean;
  startedAt: Date;
  completedAt: Date;
  stats: {
    promoted: Record<RetentionTier, number>;
    deleted: number;
    archived: number;
    archivedBytes: number;
    archiveSkipped: number;
    archiveErrors: number;
    preserved: number;
    errors: number;
  };
  errors: string[];
}

/**
 * Options for running the retention job
 */
export interface RetentionJobOptions {
  /** Dry run - don't actually modify data */
  dryRun?: boolean | undefined;
  /** Maximum number of snapshots to process per tier */
  batchSize?: number | undefined;
  /** Only process snapshots for specific character IDs */
  profileIds?: string[] | undefined;
}

/**
 * Get the bucket key for a timestamp based on the tier
 */
function getBucketKey(date: Date, tier: RetentionTier): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hour = String(date.getUTCHours()).padStart(2, '0');

  switch (tier) {
    case 'realtime':
      return `${year}-${month}-${day}T${hour}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
    case 'hourly':
      return `${year}-${month}-${day}T${hour}`;
    case 'daily':
      return `${year}-${month}-${day}`;
    case 'weekly': {
      // ISO week number
      const firstDayOfYear = new Date(Date.UTC(year, 0, 1));
      const daysSinceFirstDay = Math.floor(
        (date.getTime() - firstDayOfYear.getTime()) / (24 * 60 * 60 * 1000)
      );
      const weekNumber = Math.ceil((daysSinceFirstDay + firstDayOfYear.getUTCDay() + 1) / 7);
      return `${year}-W${String(weekNumber).padStart(2, '0')}`;
    }
    case 'monthly':
      return `${year}-${month}`;
    case 'milestone':
      return 'milestone';
    default:
      return `${year}-${month}-${day}`;
  }
}

/**
 * Calculate expiration date for a snapshot based on its tier
 */
export function calculateExpirationDate(
  capturedAt: Date,
  tier: RetentionTier
): Date | null {
  const config = RETENTION_CONFIG[tier];
  if (!config.maxAge) {
    return null; // Never expires
  }
  return new Date(capturedAt.getTime() + config.maxAge);
}

/**
 * Determine if a snapshot should be promoted to a higher tier
 */
export function shouldPromote(snapshot: CharacterSnapshot): boolean {
  const tier = snapshot.retentionTier;
  const config = RETENTION_CONFIG[tier];

  // Milestones and monthly snapshots don't promote
  if (!config.promoteTo) {
    return false;
  }

  const age = Date.now() - snapshot.capturedAt.getTime();
  return age > config.maxAge;
}

/**
 * Find the best representative snapshot for a time bucket
 * Prefers snapshots with more data (RuneLite > hiscores)
 */
function selectBestSnapshot(snapshots: CharacterSnapshot[]): CharacterSnapshot {
  const first = snapshots[0];
  if (!first) {
    throw new Error('selectBestSnapshot called with empty array');
  }
  if (snapshots.length === 1) {
    return first;
  }

  // Sort by preference: milestones first, then RuneLite data, then most recent
  const sorted = snapshots.sort((a, b) => {
    // Milestones always win
    if (a.isMilestone && !b.isMilestone) return -1;
    if (!a.isMilestone && b.isMilestone) return 1;

    // Prefer RuneLite data
    if (a.dataSource === 'runelite' && b.dataSource !== 'runelite') return -1;
    if (a.dataSource !== 'runelite' && b.dataSource === 'runelite') return 1;

    // Prefer snapshots with more data
    const aDataScore =
      (a.quests ? 1 : 0) +
      (a.achievementDiaries ? 1 : 0) +
      (a.combatAchievements ? 1 : 0) +
      (a.collectionLog ? 1 : 0);
    const bDataScore =
      (b.quests ? 1 : 0) +
      (b.achievementDiaries ? 1 : 0) +
      (b.combatAchievements ? 1 : 0) +
      (b.collectionLog ? 1 : 0);

    if (aDataScore !== bDataScore) {
      return bDataScore - aDataScore;
    }

    // Prefer higher total level (more progress)
    if (a.totalLevel !== b.totalLevel) {
      return b.totalLevel - a.totalLevel;
    }

    // Finally, prefer most recent
    return b.capturedAt.getTime() - a.capturedAt.getTime();
  });
  const best = sorted[0];
  if (!best) {
    throw new Error('Unexpected empty array after sort');
  }
  return best;
}

/**
 * Run the snapshot retention job
 */
export async function runRetentionJob(
  options: RetentionJobOptions = {}
): Promise<RetentionJobResult> {
  const { dryRun = false, batchSize = 1000, profileIds } = options;
  const startedAt = new Date();
  const errors: string[] = [];

  const stats = {
    promoted: {
      realtime: 0,
      hourly: 0,
      daily: 0,
      weekly: 0,
      monthly: 0,
      milestone: 0,
    },
    deleted: 0,
    archived: 0,
    archivedBytes: 0,
    archiveSkipped: 0,
    archiveErrors: 0,
    preserved: 0,
    errors: 0,
  };

  logger.info({ dryRun, batchSize, profileIds }, 'Starting retention job');

  const db = getDbClient();
  const archivePolicy = getSnapshotArchivePolicy();

  if (!archivePolicy.enabled) {
    logger.warn(
      { reason: archivePolicy.reason },
      'Snapshot archiving disabled - deletions will be skipped'
    );
  } else if (!archivePolicy.allowDelete) {
    logger.info(
      { reason: archivePolicy.reason },
      'Snapshot archiving enabled in archive-only mode'
    );
  }

  try {
    // Process each tier that can be promoted (realtime -> hourly -> daily -> weekly)
    const promotableTiers: RetentionTier[] = ['realtime', 'hourly', 'daily', 'weekly'];

    for (const tier of promotableTiers) {
      const config = RETENTION_CONFIG[tier];
      if (!config.promoteTo || !config.maxAge) continue;

      const cutoffDate = new Date(Date.now() - config.maxAge);
      const targetTier = config.promoteTo;

      logger.info(
        { tier, targetTier, cutoffDate },
        `Processing ${tier} tier promotions`
      );

      // Build query conditions
      const conditions = [
        eq(characterSnapshots.retentionTier, tier),
        lt(characterSnapshots.capturedAt, cutoffDate),
        eq(characterSnapshots.isMilestone, false), // Don't touch milestones
      ];

      if (profileIds && profileIds.length > 0) {
        conditions.push(
          sql`${characterSnapshots.profileId} = ANY(${profileIds})`
        );
      }

      // Fetch snapshots to process
      const snapshotsToProcess = await db
        .select()
        .from(characterSnapshots)
        .where(and(...conditions))
        .orderBy(characterSnapshots.profileId, characterSnapshots.capturedAt)
        .limit(batchSize);

      if (snapshotsToProcess.length === 0) {
        logger.info({ tier }, 'No snapshots to process for tier');
        continue;
      }

      // Group snapshots by character and time bucket
      const groupedSnapshots = new Map<
        string,
        Map<string, CharacterSnapshot[]>
      >();

      for (const snapshot of snapshotsToProcess) {
        const charId = snapshot.profileId;
        const bucketKey = getBucketKey(snapshot.capturedAt, targetTier);

        let charBuckets = groupedSnapshots.get(charId);
        if (!charBuckets) {
          charBuckets = new Map();
          groupedSnapshots.set(charId, charBuckets);
        }

        let bucketSnapshots = charBuckets.get(bucketKey);
        if (!bucketSnapshots) {
          bucketSnapshots = [];
          charBuckets.set(bucketKey, bucketSnapshots);
        }

        bucketSnapshots.push(snapshot);
      }

      // Process each character's buckets
      for (const [_charId, buckets] of groupedSnapshots) {
        for (const [bucketKey, bucketSnapshots] of buckets) {
          try {
            // Select the best snapshot to keep
            const bestSnapshot = selectBestSnapshot(bucketSnapshots);
            const snapshotsToDelete = bucketSnapshots.filter(
              (s) => s.id !== bestSnapshot.id
            );
            let archiveResult: Awaited<
              ReturnType<typeof archiveSnapshotsBatch>
            > | null = null;

            if (!dryRun) {
              // Promote the best snapshot to the target tier
              const newExpiresAt = calculateExpirationDate(
                bestSnapshot.capturedAt,
                targetTier
              );

              await db
                .update(characterSnapshots)
                .set({
                  retentionTier: targetTier,
                  expiresAt: newExpiresAt,
                })
                .where(eq(characterSnapshots.id, bestSnapshot.id));

              // Delete the redundant snapshots
              if (snapshotsToDelete.length > 0) {
                archiveResult = await archiveSnapshotsBatch({
                  profileId: bestSnapshot.profileId,
                  sourceTier: tier,
                  targetTier,
                  reason: 'promotion',
                  bucketKey,
                  snapshots: snapshotsToDelete,
                });

                if (archiveResult.status === 'archived') {
                  stats.archived += snapshotsToDelete.length;
                  stats.archivedBytes += archiveResult.sizeBytes;
                } else if (archiveResult.status === 'exists') {
                  stats.archived += snapshotsToDelete.length;
                } else if (
                  archiveResult.status === 'disabled' ||
                  archiveResult.status === 'skipped'
                ) {
                  stats.archiveSkipped += snapshotsToDelete.length;
                } else if (archiveResult.status === 'failed') {
                  stats.archiveErrors += 1;
                  stats.errors += 1;
                  errors.push(`Archive failed for bucket: ${archiveResult.error}`);
                }

                const archiveSucceeded =
                  archiveResult.status === 'archived' ||
                  archiveResult.status === 'exists';

                if (archivePolicy.allowDelete && archiveSucceeded) {
                  await db.delete(characterSnapshots).where(
                    sql`${characterSnapshots.id} = ANY(${snapshotsToDelete.map((s) => s.id)})`
                  );
                  stats.deleted += snapshotsToDelete.length;
                } else {
                  logger.warn(
                    {
                      profileId: bestSnapshot.profileId,
                      bucketKey,
                      tier,
                      targetTier,
                      allowDelete: archivePolicy.allowDelete,
                      archiveStatus: archiveResult.status,
                    },
                    'Skipped snapshot deletion (archive not ready or deletions disabled)'
                  );
                }
              }
            } else if (snapshotsToDelete.length > 0) {
              stats.archiveSkipped += snapshotsToDelete.length;
              stats.deleted += snapshotsToDelete.length;
            }

            stats.promoted[tier]++;
          } catch (err) {
            const errorMessage =
              err instanceof Error ? err.message : 'Unknown error';
            errors.push(`Error processing bucket: ${errorMessage}`);
            stats.errors++;
            logger.error({ err }, 'Error processing snapshot bucket');
          }
        }
      }

      logger.info(
        { tier, promoted: stats.promoted[tier], deleted: stats.deleted },
        `Completed ${tier} tier processing`
      );
    }

    // Delete expired snapshots (those with expiresAt in the past)
    logger.info('Deleting expired snapshots');

    const expiredConditions = [
      isNotNull(characterSnapshots.expiresAt),
      lt(characterSnapshots.expiresAt, new Date()),
      eq(characterSnapshots.isMilestone, false), // Never delete milestones
    ];

    if (profileIds && profileIds.length > 0) {
      expiredConditions.push(
        sql`${characterSnapshots.profileId} = ANY(${profileIds})`
      );
    }

    const expiredSnapshots = await db
      .select()
      .from(characterSnapshots)
      .where(and(...expiredConditions))
      .orderBy(characterSnapshots.capturedAt)
      .limit(batchSize);

    if (expiredSnapshots.length > 0) {
      const groupedExpired = new Map<
        string,
        Map<RetentionTier, Map<string, CharacterSnapshot[]>>
      >();

      for (const snapshot of expiredSnapshots) {
        const profileId = snapshot.profileId;
        const tier = snapshot.retentionTier;
        const bucketKey = getBucketKey(snapshot.capturedAt, tier);

        let profileBuckets = groupedExpired.get(profileId);
        if (!profileBuckets) {
          profileBuckets = new Map();
          groupedExpired.set(profileId, profileBuckets);
        }

        let tierBuckets = profileBuckets.get(tier);
        if (!tierBuckets) {
          tierBuckets = new Map();
          profileBuckets.set(tier, tierBuckets);
        }

        let bucketSnapshots = tierBuckets.get(bucketKey);
        if (!bucketSnapshots) {
          bucketSnapshots = [];
          tierBuckets.set(bucketKey, bucketSnapshots);
        }

        bucketSnapshots.push(snapshot);
      }

      for (const [profileId, tiers] of groupedExpired) {
        for (const [tier, buckets] of tiers) {
          for (const [bucketKey, bucketSnapshots] of buckets) {
            if (dryRun) {
              stats.archiveSkipped += bucketSnapshots.length;
              stats.deleted += bucketSnapshots.length;
              continue;
            }

            const archiveResult = await archiveSnapshotsBatch({
              profileId,
              sourceTier: tier,
              reason: 'expiration',
              bucketKey,
              snapshots: bucketSnapshots,
            });

            if (archiveResult.status === 'archived') {
              stats.archived += bucketSnapshots.length;
              stats.archivedBytes += archiveResult.sizeBytes;
            } else if (archiveResult.status === 'exists') {
              stats.archived += bucketSnapshots.length;
            } else if (
              archiveResult.status === 'disabled' ||
              archiveResult.status === 'skipped'
            ) {
              stats.archiveSkipped += bucketSnapshots.length;
            } else if (archiveResult.status === 'failed') {
              stats.archiveErrors += 1;
              stats.errors += 1;
              errors.push(`Archive failed for expired bucket: ${archiveResult.error}`);
            }

            const archiveSucceeded =
              archiveResult.status === 'archived' ||
              archiveResult.status === 'exists';

            if (archivePolicy.allowDelete && archiveSucceeded) {
              await db.delete(characterSnapshots).where(
                sql`${characterSnapshots.id} = ANY(${bucketSnapshots.map((s) => s.id)})`
              );
              stats.deleted += bucketSnapshots.length;
            } else {
              logger.warn(
                {
                  profileId,
                  bucketKey,
                  tier,
                  allowDelete: archivePolicy.allowDelete,
                  archiveStatus: archiveResult.status,
                },
                'Skipped expired snapshot deletion (archive not ready or deletions disabled)'
              );
            }
          }
        }
      }
    } else if (dryRun) {
      const expiredCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(characterSnapshots)
        .where(and(...expiredConditions));

      const count = Number(expiredCount[0]?.count ?? 0);
      logger.info({ count }, 'Would delete expired snapshots (dry run)');
    }

    // Count preserved milestones
    const milestoneCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(characterSnapshots)
      .where(eq(characterSnapshots.isMilestone, true));

    stats.preserved = Number(milestoneCount[0]?.count ?? 0);

    const completedAt = new Date();
    const result: RetentionJobResult = {
      success: errors.length === 0,
      startedAt,
      completedAt,
      stats,
      errors,
    };

    logger.info(
      {
        dryRun,
        duration: completedAt.getTime() - startedAt.getTime(),
        stats,
      },
      'Retention job completed'
    );

    return result;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    errors.push(`Fatal error: ${errorMessage}`);
    logger.error({ err }, 'Retention job failed');

    return {
      success: false,
      startedAt,
      completedAt: new Date(),
      stats,
      errors,
    };
  }
}

/**
 * Mark a snapshot as a milestone (will never be deleted)
 */
export async function markSnapshotAsMilestone(
  snapshotId: string,
  milestoneType: string,
  milestoneData?: Record<string, unknown>
): Promise<void> {
  const db = getDbClient();

  await db
    .update(characterSnapshots)
    .set({
      isMilestone: true,
      milestoneType,
      milestoneData: milestoneData ?? null,
      retentionTier: 'milestone',
      expiresAt: null, // Never expires
    })
    .where(eq(characterSnapshots.id, snapshotId));

  logger.info({ snapshotId, milestoneType }, 'Marked snapshot as milestone');
}

/**
 * Detect milestones by comparing two snapshots
 * Returns milestone events that should be recorded
 */
export function detectMilestones(
  previous: CharacterSnapshot | null,
  current: CharacterSnapshot
): Array<{ type: string; data: Record<string, unknown> }> {
  const milestones: Array<{ type: string; data: Record<string, unknown> }> = [];

  if (!previous) {
    // First snapshot - mark as milestone if significant
    if (current.totalLevel >= 500) {
      milestones.push({
        type: 'first_sync',
        data: { totalLevel: current.totalLevel },
      });
    }
    return milestones;
  }

  // Check for level ups (99s are special)
  for (const currentSkill of current.skills) {
    const previousSkill = previous.skills.find(
      (s) => s.name === currentSkill.name
    );

    if (previousSkill) {
      // Level 99 milestone
      if (previousSkill.level < 99 && currentSkill.level >= 99) {
        milestones.push({
          type: 'level_99',
          data: { skill: currentSkill.name, xp: currentSkill.xp },
        });
      }
      // Every 10 levels milestone for combat stats
      else if (
        ['attack', 'strength', 'defence', 'hitpoints', 'ranged', 'magic', 'prayer'].includes(
          currentSkill.name.toLowerCase()
        )
      ) {
        const prevTens = Math.floor(previousSkill.level / 10);
        const currTens = Math.floor(currentSkill.level / 10);
        if (currTens > prevTens && currentSkill.level >= 70) {
          milestones.push({
            type: 'level_milestone',
            data: {
              skill: currentSkill.name,
              level: currTens * 10,
            },
          });
        }
      }
    }
  }

  // Total level milestones (every 100 after 1500, every 250 after 2000)
  const prevTotal = previous.totalLevel;
  const currTotal = current.totalLevel;

  if (currTotal >= 2277 && prevTotal < 2277) {
    milestones.push({ type: 'max_total', data: { totalLevel: 2277 } });
  } else if (currTotal >= 2000) {
    const prevMilestone = Math.floor(prevTotal / 250) * 250;
    const currMilestone = Math.floor(currTotal / 250) * 250;
    if (currMilestone > prevMilestone) {
      milestones.push({
        type: 'total_level_milestone',
        data: { totalLevel: currMilestone },
      });
    }
  } else if (currTotal >= 1500) {
    const prevMilestone = Math.floor(prevTotal / 100) * 100;
    const currMilestone = Math.floor(currTotal / 100) * 100;
    if (currMilestone > prevMilestone) {
      milestones.push({
        type: 'total_level_milestone',
        data: { totalLevel: currMilestone },
      });
    }
  }

  // Combat level milestones (126 max, 100+, etc.)
  if (current.combatLevel >= 126 && previous.combatLevel < 126) {
    milestones.push({ type: 'max_combat', data: { combatLevel: 126 } });
  } else if (current.combatLevel >= 100 && previous.combatLevel < 100) {
    milestones.push({
      type: 'combat_milestone',
      data: { combatLevel: 100 },
    });
  }

  return milestones;
}

/**
 * Get retention statistics for a character
 */
export async function getCharacterRetentionStats(
  profileId: string
): Promise<{
  total: number;
  byTier: Record<RetentionTier, number>;
  milestones: number;
  oldestSnapshot: Date | null;
  newestSnapshot: Date | null;
}> {
  const db = getDbClient();

  const results = await db
    .select({
      tier: characterSnapshots.retentionTier,
      count: sql<number>`count(*)`,
      oldest: sql<Date>`min(${characterSnapshots.capturedAt})`,
      newest: sql<Date>`max(${characterSnapshots.capturedAt})`,
      milestones: sql<number>`sum(case when ${characterSnapshots.isMilestone} then 1 else 0 end)`,
    })
    .from(characterSnapshots)
    .where(eq(characterSnapshots.profileId, profileId))
    .groupBy(characterSnapshots.retentionTier);

  const byTier: Record<RetentionTier, number> = {
    realtime: 0,
    hourly: 0,
    daily: 0,
    weekly: 0,
    monthly: 0,
    milestone: 0,
  };

  let total = 0;
  let milestones = 0;
  let oldestSnapshot: Date | null = null;
  let newestSnapshot: Date | null = null;

  for (const row of results) {
    const tier = row.tier;
    const count = Number(row.count);
    byTier[tier] = count;
    total += count;
    milestones += Number(row.milestones);

    if (row.oldest) {
      const oldest = new Date(row.oldest);
      if (!oldestSnapshot || oldest < oldestSnapshot) {
        oldestSnapshot = oldest;
      }
    }

    if (row.newest) {
      const newest = new Date(row.newest);
      if (!newestSnapshot || newest > newestSnapshot) {
        newestSnapshot = newest;
      }
    }
  }

  return {
    total,
    byTier,
    milestones,
    oldestSnapshot,
    newestSnapshot,
  };
}

/**
 * Get global retention statistics
 */
export async function getGlobalRetentionStats(): Promise<{
  totalSnapshots: number;
  byTier: Record<RetentionTier, number>;
  totalMilestones: number;
  charactersWithSnapshots: number;
  expiringSoon: number; // Expiring in next 24 hours
}> {
  const db = getDbClient();

  const tierResults = await db
    .select({
      tier: characterSnapshots.retentionTier,
      count: sql<number>`count(*)`,
    })
    .from(characterSnapshots)
    .groupBy(characterSnapshots.retentionTier);

  const byTier: Record<RetentionTier, number> = {
    realtime: 0,
    hourly: 0,
    daily: 0,
    weekly: 0,
    monthly: 0,
    milestone: 0,
  };

  let totalSnapshots = 0;
  for (const row of tierResults) {
    const tier = row.tier;
    const count = Number(row.count);
    byTier[tier] = count;
    totalSnapshots += count;
  }

  const [milestoneResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(characterSnapshots)
    .where(eq(characterSnapshots.isMilestone, true));

  const [characterResult] = await db
    .select({ count: sql<number>`count(distinct ${characterSnapshots.profileId})` })
    .from(characterSnapshots);

  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const [expiringResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(characterSnapshots)
    .where(
      and(
        isNotNull(characterSnapshots.expiresAt),
        lt(characterSnapshots.expiresAt, tomorrow),
        gt(characterSnapshots.expiresAt, new Date())
      )
    );

  return {
    totalSnapshots,
    byTier,
    totalMilestones: Number(milestoneResult?.count ?? 0),
    charactersWithSnapshots: Number(characterResult?.count ?? 0),
    expiringSoon: Number(expiringResult?.count ?? 0),
  };
}
