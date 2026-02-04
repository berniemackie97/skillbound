import type { CharacterSnapshot } from '@skillbound/database';
import { diffSnapshots, type ProgressDiff } from '@skillbound/domain';

import { toProgressSnapshot } from './snapshots';

export type SnapshotRangeSummary = {
  count: number;
  fromSnapshotId: string;
  toSnapshotId: string;
  fromCapturedAt: Date;
  toCapturedAt: Date;
  diff: ProgressDiff;
};

export function summarizeSnapshotRange(
  snapshots: CharacterSnapshot[]
): SnapshotRangeSummary | null {
  if (snapshots.length < 2) {
    return null;
  }

  const ordered = [...snapshots].sort(
    (a, b) => a.capturedAt.getTime() - b.capturedAt.getTime()
  );
  const from = ordered[0];
  const to = ordered[ordered.length - 1];

  if (!from || !to) {
    return null;
  }

  const diff = diffSnapshots(toProgressSnapshot(from), toProgressSnapshot(to));

  return {
    count: ordered.length,
    fromSnapshotId: from.id,
    toSnapshotId: to.id,
    fromCapturedAt: from.capturedAt,
    toCapturedAt: to.capturedAt,
    diff,
  };
}
