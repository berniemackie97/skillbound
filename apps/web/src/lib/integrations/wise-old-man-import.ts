import type {
  CharacterProfile,
  DbClient,
  NewCharacterSnapshot,
} from '@skillbound/database';
import {
  and,
  characterSnapshots,
  characterProfiles,
  desc,
  eq,
  gte,
  ilike,
  lte,
  sql,
} from '@skillbound/database';
import {
  calculateCombatLevel,
  calculateTotalLevel,
  calculateTotalXp,
  type SkillSnapshot,
  SKILLS,
} from '@skillbound/domain';
import {
  createWiseOldManClient,
  type WiseOldManPlayer,
  type WiseOldManSnapshot,
} from '@skillbound/integrations/wise-old-man';

import {
  getIntegrationsCache,
  getIntegrationsCacheTtlMs,
} from '../cache/integrations-cache';
import { logger } from '../logging/logger';
import {
  calculateExpirationDate,
  type RetentionTier,
} from '../snapshots/snapshot-retention';

type WiseOldManImportOptions = {
  period?: 'day' | 'week' | 'month' | 'year';
  maxSnapshots?: number;
  minSnapshots?: number;
  requireEarlier?: boolean;
  requireActivities?: boolean;
};

type WiseOldManImportResult = {
  attempted: number;
  inserted: number;
  skipped: number;
  reason?: string;
};

function normalizeNumber(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.floor(value));
}

function normalizeLevel(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 1;
  }
  return Math.max(1, Math.floor(value));
}

function pickRetentionTier(capturedAt: Date): RetentionTier {
  const ageMs = Date.now() - capturedAt.getTime();
  const day = 24 * 60 * 60 * 1000;

  if (ageMs <= day) {
    return 'realtime';
  }
  if (ageMs <= 7 * day) {
    return 'hourly';
  }
  if (ageMs <= 90 * day) {
    return 'daily';
  }
  if (ageMs <= 365 * day) {
    return 'weekly';
  }
  return 'monthly';
}

function mapWiseOldManSnapshot(
  profileId: string,
  snapshot: WiseOldManSnapshot
): NewCharacterSnapshot {
  const capturedAt = new Date(snapshot.createdAt);
  const skillMap = snapshot.data.skills ?? {};

  const skills: SkillSnapshot[] = SKILLS.map((skillName) => {
    const skill = skillMap[skillName];
    return {
      name: skillName,
      level: normalizeLevel(skill?.level ?? 1),
      xp: normalizeNumber(skill?.experience ?? 0),
      rank:
        typeof skill?.rank === 'number' && Number.isFinite(skill.rank)
          ? Math.floor(skill.rank)
          : null,
    };
  });

  const activities: Record<string, number> = {};
  const activityMap = snapshot.data.activities ?? {};
  const bossMap = snapshot.data.bosses ?? {};

  for (const [key, activity] of Object.entries(activityMap)) {
    const score = normalizeNumber(activity?.score ?? 0);
    if (score > 0) {
      activities[key] = score;
    }
  }

  for (const [key, boss] of Object.entries(bossMap)) {
    const kills = normalizeNumber(boss?.kills ?? 0);
    if (kills > 0) {
      activities[key] = kills;
    }
  }

  const totalLevel = calculateTotalLevel(skills);
  const totalXp = calculateTotalXp(skills);
  const skillLevels: Partial<Record<(typeof SKILLS)[number], number>> = {};
  for (const skill of skills) {
    skillLevels[skill.name] = skill.level;
  }
  const combatLevel = calculateCombatLevel(skillLevels);
  const retentionTier = pickRetentionTier(capturedAt);

  return {
    profileId,
    capturedAt,
    dataSource: 'hiscores',
    dataSourceWarning: 'wise-old-man import',
    totalLevel,
    totalXp,
    combatLevel,
    skills,
    activities: Object.keys(activities).length > 0 ? activities : null,
    retentionTier,
    expiresAt: calculateExpirationDate(capturedAt, retentionTier),
  };
}

function mapSnapshotForClone(
  targetProfileId: string,
  snapshot: typeof characterSnapshots.$inferSelect
): NewCharacterSnapshot {
  return {
    profileId: targetProfileId,
    capturedAt: snapshot.capturedAt,
    dataSource: snapshot.dataSource,
    dataSourceWarning: snapshot.dataSourceWarning ?? null,
    totalLevel: snapshot.totalLevel,
    totalXp: snapshot.totalXp,
    combatLevel: snapshot.combatLevel,
    skills: snapshot.skills,
    activities: snapshot.activities ?? null,
    quests: snapshot.quests ?? null,
    achievementDiaries: snapshot.achievementDiaries ?? null,
    musicTracks: snapshot.musicTracks ?? null,
    combatAchievements: snapshot.combatAchievements ?? null,
    collectionLog: snapshot.collectionLog ?? null,
    retentionTier: snapshot.retentionTier,
    isMilestone: snapshot.isMilestone,
    milestoneType: snapshot.milestoneType ?? null,
    milestoneData: snapshot.milestoneData ?? null,
    expiresAt: snapshot.expiresAt ?? null,
  };
}

async function cloneSnapshotsFromCharacter(
  db: DbClient,
  sourceId: string,
  targetId: string
) {
  if (sourceId === targetId) {
    return 0;
  }

  const [sourceCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(characterSnapshots)
    .where(eq(characterSnapshots.profileId, sourceId));

  if (!Number(sourceCount?.count ?? 0)) {
    return 0;
  }

  const sourceSnapshots = await db
    .select()
    .from(characterSnapshots)
    .where(eq(characterSnapshots.profileId, sourceId));

  const existing = await db
    .select({
      capturedAt: characterSnapshots.capturedAt,
      activities: characterSnapshots.activities,
    })
    .from(characterSnapshots)
    .where(eq(characterSnapshots.profileId, targetId));

  const existingMap = new Map(
    existing.map((row) => [row.capturedAt.getTime(), row.activities])
  );

  const inserts = sourceSnapshots
    .filter((snapshot) => !existingMap.has(snapshot.capturedAt.getTime()))
    .map((snapshot) => mapSnapshotForClone(targetId, snapshot));

  if (inserts.length === 0) {
    let updated = 0;
    for (const snapshot of sourceSnapshots) {
      const key = snapshot.capturedAt.getTime();
      const targetActivities = existingMap.get(key);
      if (!targetActivities && snapshot.activities) {
        await db
          .update(characterSnapshots)
          .set({ activities: snapshot.activities })
          .where(
            and(
              eq(characterSnapshots.profileId, targetId),
              eq(characterSnapshots.capturedAt, snapshot.capturedAt)
            )
          );
        updated += 1;
      }
    }
    return updated;
  }

  await db.insert(characterSnapshots).values(inserts);
  return inserts.length;
}

export async function importWiseOldManSnapshots(
  db: DbClient,
  profile: CharacterProfile,
  options: WiseOldManImportOptions = {}
): Promise<WiseOldManImportResult> {
  if (process.env['WISE_OLD_MAN_IMPORT_ENABLED'] !== 'true') {
    return { attempted: 0, inserted: 0, skipped: 0 };
  }

  const matchingCharacters = await db
    .select({
      id: characterProfiles.id,
      womBackfillCheckedAt: characterProfiles.womBackfillCheckedAt,
    })
    .from(characterProfiles)
    .where(
      and(
        ilike(characterProfiles.displayName, profile.displayName),
        eq(characterProfiles.mode, profile.mode)
      )
    );

  const globalChecked = matchingCharacters.find(
    (row) => row.womBackfillCheckedAt
  );

  if (globalChecked?.womBackfillCheckedAt) {
    const sourceId = globalChecked.id;
    if (sourceId && sourceId !== profile.id) {
      const cloned = await cloneSnapshotsFromCharacter(
        db,
        sourceId,
        profile.id
      );

      if (cloned > 0 && !profile.womBackfillCheckedAt) {
        await db
          .update(characterProfiles)
          .set({ womBackfillCheckedAt: globalChecked.womBackfillCheckedAt })
          .where(eq(characterProfiles.id, profile.id));
        return {
          attempted: 0,
          inserted: cloned,
          skipped: 0,
          reason: 'already_checked',
        };
      }
    }

    if (profile.womBackfillCheckedAt) {
      return {
        attempted: 0,
        inserted: 0,
        skipped: 0,
        reason: 'already_checked',
      };
    }
  }

  const minSnapshotsEnv = process.env['WISE_OLD_MAN_MIN_SNAPSHOTS'];
  const minSnapshots = Number.isFinite(Number(minSnapshotsEnv))
    ? Number(minSnapshotsEnv)
    : 8;
  const minThreshold = options.minSnapshots ?? minSnapshots;
  const requireEarlier = options.requireEarlier ?? true;
  const requireActivities = options.requireActivities ?? true;

  const userAgent =
    process.env['SKILLBOUND_USER_AGENT'] ??
    process.env['INTEGRATIONS_USER_AGENT'];

  const [existingSummary] = await db
    .select({
      count: sql<number>`count(*)`,
      oldest: sql<Date | null>`min(${characterSnapshots.capturedAt})`,
    })
    .from(characterSnapshots)
    .where(eq(characterSnapshots.profileId, profile.id));

  const existingCount = Number(existingSummary?.count ?? 0);
  const existingOldestRaw = existingSummary?.oldest ?? null;
  const existingOldest =
    existingOldestRaw instanceof Date
      ? existingOldestRaw
      : existingOldestRaw
        ? new Date(existingOldestRaw)
        : null;

  const [latestSnapshot] = await db
    .select({
      activities: characterSnapshots.activities,
    })
    .from(characterSnapshots)
    .where(eq(characterSnapshots.profileId, profile.id))
    .orderBy(desc(characterSnapshots.capturedAt))
    .limit(1);

  const hasActivities =
    latestSnapshot?.activities &&
    Object.keys(latestSnapshot.activities).length > 0;

  const hasEnoughSnapshots = existingCount >= minThreshold;

  if (hasEnoughSnapshots && (!requireActivities || hasActivities)) {
    return {
      attempted: 0,
      inserted: 0,
      skipped: 0,
      reason: 'history_sufficient',
    };
  }

  const client = createWiseOldManClient({
    cache: getIntegrationsCache<WiseOldManPlayer>(),
    cacheTtlMs: getIntegrationsCacheTtlMs('wise-old-man'),
    ...(process.env['WISE_OLD_MAN_BASE_URL']
      ? { baseUrl: process.env['WISE_OLD_MAN_BASE_URL'] }
      : {}),
    ...(userAgent ? { userAgent } : {}),
  });

  const snapshots = await client.getPlayerSnapshots(profile.displayName, {
    period: options.period ?? 'year',
  });

  const sorted = [...snapshots].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const limited =
    options.maxSnapshots && options.maxSnapshots > 0
      ? sorted.slice(0, options.maxSnapshots)
      : sorted;

  if (limited.length === 0) {
    return { attempted: 0, inserted: 0, skipped: 0, reason: 'no_snapshots' };
  }

  const capturedDates = limited
    .map((snap) => new Date(snap.createdAt))
    .filter((date) => !Number.isNaN(date.getTime()));

  if (capturedDates.length === 0) {
    return {
      attempted: limited.length,
      inserted: 0,
      skipped: 0,
      reason: 'invalid_dates',
    };
  }

  const minDate = new Date(
    Math.min(...capturedDates.map((date) => date.getTime()))
  );
  const maxDate = new Date(
    Math.max(...capturedDates.map((date) => date.getTime()))
  );

  const hasEarlierHistory =
    existingOldest &&
    Number.isFinite(existingOldest.getTime()) &&
    minDate.getTime() < existingOldest.getTime();

  if (
    hasEnoughSnapshots &&
    requireEarlier &&
    !hasEarlierHistory &&
    (!requireActivities || hasActivities)
  ) {
    return {
      attempted: 0,
      inserted: 0,
      skipped: 0,
      reason: 'history_sufficient',
    };
  }

  const existing = await db
    .select({ capturedAt: characterSnapshots.capturedAt })
    .from(characterSnapshots)
    .where(
      and(
        gte(characterSnapshots.capturedAt, minDate),
        lte(characterSnapshots.capturedAt, maxDate),
        eq(characterSnapshots.profileId, profile.id)
      )
    );

  const existingSet = new Set(
    existing.map((row: { capturedAt: Date }) => row.capturedAt.getTime())
  );

  const inserts: NewCharacterSnapshot[] = [];
  let skipped = 0;

  for (const snapshot of limited) {
    const mapped = mapWiseOldManSnapshot(profile.id, snapshot);
    const key = mapped.capturedAt?.getTime();
    if (key && existingSet.has(key)) {
      skipped += 1;
      continue;
    }
    inserts.push(mapped);
  }

  if (inserts.length === 0) {
    let updated = 0;
    for (const snapshot of limited) {
      const mapped = mapWiseOldManSnapshot(profile.id, snapshot);
      const capturedAt = mapped.capturedAt;
      if (!capturedAt || !existingSet.has(capturedAt.getTime())) {
        continue;
      }

      if (mapped.activities) {
        await db
          .update(characterSnapshots)
          .set({ activities: mapped.activities })
          .where(
            and(
              eq(characterSnapshots.profileId, profile.id),
              eq(characterSnapshots.capturedAt, capturedAt)
            )
          );
        updated += 1;
      }
    }

    if (updated > 0) {
      const checkedAt = new Date();
      await db
        .update(characterProfiles)
        .set({ womBackfillCheckedAt: checkedAt })
        .where(
          and(
            ilike(characterProfiles.displayName, profile.displayName),
            eq(characterProfiles.mode, profile.mode)
          )
        );
    }

    return { attempted: limited.length, inserted: updated, skipped };
  }

  if (inserts.length === 0) {
    return {
      attempted: limited.length,
      inserted: 0,
      skipped,
      reason: 'no_new_snapshots',
    };
  }

  await db.insert(characterSnapshots).values(inserts);

  const checkedAt = new Date();
  await db
    .update(characterProfiles)
    .set({ womBackfillCheckedAt: checkedAt })
    .where(
      and(
        ilike(characterProfiles.displayName, profile.displayName),
        eq(characterProfiles.mode, profile.mode)
      )
    );

  logger.info(
    {
      profileId: profile.id,
      inserted: inserts.length,
      skipped,
      minDate,
      maxDate,
    },
    'Imported Wise Old Man snapshots'
  );

  return { attempted: limited.length, inserted: inserts.length, skipped };
}
