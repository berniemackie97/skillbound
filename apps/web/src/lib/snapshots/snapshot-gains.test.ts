import type { CharacterSnapshot } from '@skillbound/database';
import { describe, expect, it } from 'vitest';

import { summarizeSnapshotGains } from './snapshot-gains';

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
  skills: [{ name: 'attack', level: 1, xp: 0, rank: null }],
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

describe('summarizeSnapshotGains', () => {
  it('returns null when fewer than two snapshots exist', () => {
    const summary = summarizeSnapshotGains([
      snapshot('2026-01-01T00:00:00.000Z'),
    ]);

    expect(summary).toBeNull();
  });

  it('computes duration and rates', () => {
    const summary = summarizeSnapshotGains([
      snapshot('2026-01-01T00:00:00.000Z', {
        totalLevel: 10,
        totalXp: 1000,
        combatLevel: 3,
        skills: [{ name: 'attack', level: 1, xp: 0, rank: null }],
      }),
      snapshot('2026-01-03T00:00:00.000Z', {
        totalLevel: 12,
        totalXp: 1400,
        combatLevel: 4,
        skills: [{ name: 'attack', level: 3, xp: 400, rank: null }],
      }),
    ]);

    expect(summary?.durationDays).toBe(2);
    expect(summary?.rates?.totalXpPerDay).toBe(200);
    expect(summary?.rates?.totalXpPerHour).toBeCloseTo(8.3333, 3);
    expect(summary?.rates?.totalLevelPerDay).toBe(1);
  });

  it('returns null rates when duration is zero', () => {
    const summary = summarizeSnapshotGains([
      snapshot('2026-01-01T00:00:00.000Z'),
      snapshot('2026-01-01T00:00:00.000Z', { totalXp: 1200 }),
    ]);

    expect(summary?.durationMs).toBe(0);
    expect(summary?.rates).toBeNull();
  });
});
