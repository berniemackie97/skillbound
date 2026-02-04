import type { CharacterSnapshot } from '@skillbound/database';
import { describe, expect, it } from 'vitest';

import { summarizeSnapshotRange } from './snapshot-summary';

const snapshot = (
  profileId: string,
  capturedAt: string,
  overrides: Partial<CharacterSnapshot> = {}
): CharacterSnapshot => ({
  id: `snapshot-${profileId}-${capturedAt}`,
  profileId,
  capturedAt: new Date(capturedAt),
  dataSource: 'hiscores',
  dataSourceWarning: null,
  totalLevel: 10,
  totalXp: 1000,
  combatLevel: 3,
  skills: [
    {
      name: 'attack',
      level: 1,
      xp: 0,
      rank: null,
    },
  ],
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

describe('summarizeSnapshotRange', () => {
  it('returns null when fewer than two snapshots exist', () => {
    const summary = summarizeSnapshotRange([
      snapshot('char-1', '2026-01-01T00:00:00.000Z'),
    ]);

    expect(summary).toBeNull();
  });

  it('orders snapshots and computes diff', () => {
    const earlier = snapshot('char-1', '2026-01-01T00:00:00.000Z', {
      totalLevel: 10,
      totalXp: 1000,
      combatLevel: 3,
      skills: [{ name: 'attack', level: 1, xp: 0, rank: null }],
    });
    const later = snapshot('char-1', '2026-02-01T00:00:00.000Z', {
      totalLevel: 12,
      totalXp: 1600,
      combatLevel: 4,
      skills: [{ name: 'attack', level: 3, xp: 600, rank: null }],
    });

    const summary = summarizeSnapshotRange([later, earlier]);

    expect(summary?.count).toBe(2);
    expect(summary?.fromSnapshotId).toBe(earlier.id);
    expect(summary?.toSnapshotId).toBe(later.id);
    expect(summary?.diff.totalLevelDelta).toBe(2);
    expect(summary?.diff.totalXpDelta).toBe(600);
    expect(summary?.diff.combatLevelDelta).toBe(1);
    expect(summary?.diff.skillDeltas.attack.levelDelta).toBe(2);
  });
});
