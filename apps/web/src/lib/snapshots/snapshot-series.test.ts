import type { CharacterSnapshot } from '@skillbound/database';
import { describe, expect, it } from 'vitest';

import { buildSnapshotSeries } from './snapshot-series';

const snapshot = (
  capturedAt: string,
  overrides: Partial<CharacterSnapshot> = {}
): CharacterSnapshot => ({
  id: `snapshot-${capturedAt}`,
  profileId: 'profile-1',
  capturedAt: new Date(capturedAt),
  dataSource: 'hiscores',
  dataSourceWarning: null,
  totalLevel: 10,
  totalXp: 1000,
  combatLevel: 3,
  skills: [],
  activities: null,
  quests: null,
  achievementDiaries: null,
  musicTracks: null,
  combatAchievements: null,
  collectionLog: null,
  retentionTier: 'realtime',
  isMilestone: false,
  milestoneType: null,
  milestoneData: null,
  expiresAt: null,
  createdAt: new Date(capturedAt),
  ...overrides,
});

describe('buildSnapshotSeries', () => {
  it('returns latest snapshot per day bucket', () => {
    const series = buildSnapshotSeries(
      [
        snapshot('2026-01-02T08:00:00.000Z', { totalLevel: 10 }),
        snapshot('2026-01-02T20:00:00.000Z', { totalLevel: 12 }),
        snapshot('2026-01-03T08:00:00.000Z', { totalLevel: 13 }),
      ],
      'day'
    );

    expect(series).toHaveLength(2);
    expect(series[0]?.totalLevel).toBe(12);
    expect(series[1]?.totalLevel).toBe(13);
    expect(series[0]?.bucketStart.toISOString()).toBe(
      '2026-01-02T00:00:00.000Z'
    );
  });

  it('uses ISO week start (Monday) for week buckets', () => {
    const series = buildSnapshotSeries(
      [
        snapshot('2026-01-01T10:00:00.000Z'),
        snapshot('2026-01-03T10:00:00.000Z'),
      ],
      'week'
    );

    expect(series).toHaveLength(1);
    expect(series[0]?.bucketStart.toISOString()).toBe(
      '2025-12-29T00:00:00.000Z'
    );
  });

  it('buckets by month', () => {
    const series = buildSnapshotSeries(
      [
        snapshot('2026-02-01T01:00:00.000Z'),
        snapshot('2026-02-15T12:00:00.000Z'),
        snapshot('2026-03-01T00:00:00.000Z'),
      ],
      'month'
    );

    expect(series).toHaveLength(2);
    expect(series[0]?.bucketStart.toISOString()).toBe(
      '2026-02-01T00:00:00.000Z'
    );
    expect(series[1]?.bucketStart.toISOString()).toBe(
      '2026-03-01T00:00:00.000Z'
    );
  });
});
