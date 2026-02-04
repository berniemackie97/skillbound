import type { CharacterSnapshot } from '@skillbound/database';
import type { ProgressDiff } from '@skillbound/domain';

import { summarizeSnapshotRange } from './snapshot-summary';

export type SnapshotGainRates = {
  totalXpPerHour: number;
  totalXpPerDay: number;
  totalLevelPerDay: number;
  combatLevelPerDay: number;
};

export type SnapshotGainsSummary = {
  count: number;
  fromSnapshotId: string;
  toSnapshotId: string;
  fromCapturedAt: Date;
  toCapturedAt: Date;
  durationMs: number;
  durationHours: number;
  durationDays: number;
  diff: ProgressDiff;
  rates: SnapshotGainRates | null;
};

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function summarizeSnapshotGains(
  snapshots: CharacterSnapshot[]
): SnapshotGainsSummary | null {
  const summary = summarizeSnapshotRange(snapshots);
  if (!summary) {
    return null;
  }

  const durationMs =
    summary.toCapturedAt.getTime() - summary.fromCapturedAt.getTime();
  const durationHours = durationMs / MS_PER_HOUR;
  const durationDays = durationMs / MS_PER_DAY;

  const rates =
    durationMs > 0
      ? {
          totalXpPerHour: summary.diff.totalXpDelta / durationHours,
          totalXpPerDay: summary.diff.totalXpDelta / durationDays,
          totalLevelPerDay: summary.diff.totalLevelDelta / durationDays,
          combatLevelPerDay: summary.diff.combatLevelDelta / durationDays,
        }
      : null;

  return {
    count: summary.count,
    fromSnapshotId: summary.fromSnapshotId,
    toSnapshotId: summary.toSnapshotId,
    fromCapturedAt: summary.fromCapturedAt,
    toCapturedAt: summary.toCapturedAt,
    durationMs,
    durationHours,
    durationDays,
    diff: summary.diff,
    rates,
  };
}
