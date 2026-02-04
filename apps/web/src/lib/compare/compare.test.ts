import type { CharacterSnapshot } from '@skillbound/database';
import { describe, expect, it } from 'vitest';

import { buildLatestSnapshotMap, parseCompareQuery } from './compare';

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
  totalLevel: 100,
  totalXp: 1000,
  combatLevel: 50,
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

// Valid RFC 4122 UUIDs (version 4, variant 1)
const idA = '11111111-1111-4111-8111-111111111111';
const idB = '22222222-2222-4222-8222-222222222222';

describe('parseCompareQuery', () => {
  it('parses comma-separated ids', () => {
    const params = new URLSearchParams({ characterIds: `${idA}, ${idB}` });
    const parsed = parseCompareQuery(params);

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.characterIds).toEqual([idA, idB]);
    }
  });

  it('rejects a single id', () => {
    const params = new URLSearchParams({ characterIds: idA });
    const parsed = parseCompareQuery(params);

    expect(parsed.success).toBe(false);
  });

  it('rejects invalid ids', () => {
    const params = new URLSearchParams({ characterIds: 'not-a-uuid,also-bad' });
    const parsed = parseCompareQuery(params);

    expect(parsed.success).toBe(false);
  });
});

describe('buildLatestSnapshotMap', () => {
  it('keeps the most recent snapshot per character', () => {
    const snapshots = [
      snapshot(idA, '2024-01-01T00:00:00.000Z'),
      snapshot(idA, '2024-02-01T00:00:00.000Z'),
      snapshot(idB, '2024-03-01T00:00:00.000Z'),
      snapshot(idB, '2024-01-15T00:00:00.000Z'),
    ];

    const latest = buildLatestSnapshotMap(snapshots);

    expect(latest.get(idA)?.capturedAt.toISOString()).toBe(
      '2024-02-01T00:00:00.000Z'
    );
    expect(latest.get(idB)?.capturedAt.toISOString()).toBe(
      '2024-03-01T00:00:00.000Z'
    );
  });
});
