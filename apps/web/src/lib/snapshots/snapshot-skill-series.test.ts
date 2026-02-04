import type { CharacterSnapshot } from '@skillbound/database';
import { describe, expect, it } from 'vitest';

import { buildSkillSeries } from './snapshot-skill-series';

const snapshot = (
  capturedAt: string,
  skills: Array<{ name: string; level: number; xp: number }> = []
): CharacterSnapshot => ({
  id: `snapshot-${capturedAt}`,
  profileId: 'profile-1',
  capturedAt: new Date(capturedAt),
  dataSource: 'hiscores',
  dataSourceWarning: null,
  totalLevel: 10,
  totalXp: 1000,
  combatLevel: 3,
  skills: skills.map((skill) => ({ ...skill, rank: null })),
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
});

describe('buildSkillSeries', () => {
  it('keeps latest snapshot per bucket', () => {
    const series = buildSkillSeries(
      [
        snapshot('2026-01-02T08:00:00.000Z', [
          { name: 'attack', level: 1, xp: 0 },
        ]),
        snapshot('2026-01-02T20:00:00.000Z', [
          { name: 'attack', level: 2, xp: 100 },
        ]),
      ],
      'day',
      ['attack']
    );

    expect(series).toHaveLength(1);
    expect(series[0]?.skills.attack.level).toBe(2);
  });

  it('filters to requested skills', () => {
    const series = buildSkillSeries(
      [
        snapshot('2026-01-02T08:00:00.000Z', [
          { name: 'attack', level: 1, xp: 0 },
          { name: 'strength', level: 5, xp: 300 },
        ]),
      ],
      'day',
      ['attack']
    );

    expect(series[0]?.skills.attack.level).toBe(1);
    expect(series[0]?.skills).not.toHaveProperty('strength');
  });

  it('defaults missing skills to level 1 and xp 0', () => {
    const series = buildSkillSeries(
      [snapshot('2026-01-02T08:00:00.000Z', [])],
      'day',
      ['attack']
    );

    expect(series[0]?.skills.attack).toEqual({ level: 1, xp: 0 });
  });
});
