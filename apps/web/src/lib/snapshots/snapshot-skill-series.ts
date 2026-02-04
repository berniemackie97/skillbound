import type { CharacterSnapshot } from '@skillbound/database';
import { isSkillName, SKILLS, type SkillName } from '@skillbound/domain';

import {
  getBucketKey,
  getBucketStart,
  type SnapshotSeriesBucket,
} from './snapshot-buckets';

export type SkillSeriesPoint = {
  bucketStart: Date;
  snapshotId: string;
  capturedAt: Date;
  skills: Record<SkillName, { level: number; xp: number }>;
};

function buildSkillMap(
  snapshot: CharacterSnapshot,
  allowed: SkillName[]
): Record<SkillName, { level: number; xp: number }> {
  const map = {} as Record<SkillName, { level: number; xp: number }>;

  for (const skill of allowed) {
    map[skill] = { level: 1, xp: 0 };
  }

  for (const skill of snapshot.skills) {
    if (!isSkillName(skill.name)) {
      continue;
    }
    if (!allowed.includes(skill.name)) {
      continue;
    }
    map[skill.name] = { level: skill.level, xp: skill.xp };
  }

  return map;
}

export function buildSkillSeries(
  snapshots: CharacterSnapshot[],
  bucket: SnapshotSeriesBucket,
  skills: SkillName[] = [...SKILLS]
): SkillSeriesPoint[] {
  if (snapshots.length === 0) {
    return [];
  }

  const ordered = [...snapshots].sort(
    (a, b) => a.capturedAt.getTime() - b.capturedAt.getTime()
  );

  const latestByBucket = new Map<string, SkillSeriesPoint>();

  for (const snapshot of ordered) {
    const key = getBucketKey(snapshot.capturedAt, bucket);
    latestByBucket.set(key, {
      bucketStart: getBucketStart(snapshot.capturedAt, bucket),
      snapshotId: snapshot.id,
      capturedAt: snapshot.capturedAt,
      skills: buildSkillMap(snapshot, skills),
    });
  }

  return Array.from(latestByBucket.values()).sort(
    (a, b) => a.bucketStart.getTime() - b.bucketStart.getTime()
  );
}
