import type { CharacterSnapshot } from '@skillbound/database';

import {
  getBucketKey,
  getBucketStart,
  type SnapshotSeriesBucket,
} from './snapshot-buckets';

export type SnapshotSeriesPoint = {
  bucketStart: Date;
  snapshotId: string;
  capturedAt: Date;
  totalLevel: number;
  totalXp: number;
  combatLevel: number;
};

export function buildSnapshotSeries(
  snapshots: CharacterSnapshot[],
  bucket: SnapshotSeriesBucket
): SnapshotSeriesPoint[] {
  if (snapshots.length === 0) {
    return [];
  }

  const ordered = [...snapshots].sort(
    (a, b) => a.capturedAt.getTime() - b.capturedAt.getTime()
  );

  const latestByBucket = new Map<string, SnapshotSeriesPoint>();

  for (const snapshot of ordered) {
    const key = getBucketKey(snapshot.capturedAt, bucket);
    latestByBucket.set(key, {
      bucketStart: getBucketStart(snapshot.capturedAt, bucket),
      snapshotId: snapshot.id,
      capturedAt: snapshot.capturedAt,
      totalLevel: snapshot.totalLevel,
      totalXp: snapshot.totalXp,
      combatLevel: snapshot.combatLevel,
    });
  }

  return Array.from(latestByBucket.values()).sort(
    (a, b) => a.bucketStart.getTime() - b.bucketStart.getTime()
  );
}
