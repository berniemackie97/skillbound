import type { CharacterSnapshot } from '@skillbound/database';
import { describe, expect, it } from 'vitest';

import {
  calculateExpirationDate,
  detectMilestones,
  RETENTION_CONFIG,
  shouldPromote,
  type RetentionTier,
} from './snapshot-retention';

const createSnapshot = (
  overrides: Partial<CharacterSnapshot> = {}
): CharacterSnapshot => ({
  id: 'snapshot-1',
  profileId: 'profile-1',
  capturedAt: new Date('2024-01-15T12:00:00.000Z'),
  dataSource: 'hiscores',
  dataSourceWarning: null,
  totalLevel: 1500,
  totalXp: 50000000,
  combatLevel: 100,
  skills: [
    { name: 'Attack', level: 70, xp: 737627, rank: 500000 },
    { name: 'Strength', level: 70, xp: 737627, rank: 500000 },
    { name: 'Defence', level: 70, xp: 737627, rank: 500000 },
    { name: 'Hitpoints', level: 70, xp: 737627, rank: 500000 },
    { name: 'Ranged', level: 70, xp: 737627, rank: 500000 },
    { name: 'Magic', level: 70, xp: 737627, rank: 500000 },
    { name: 'Prayer', level: 70, xp: 737627, rank: 500000 },
    { name: 'Cooking', level: 50, xp: 101333, rank: 1000000 },
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
  createdAt: new Date('2024-01-15T12:00:00.000Z'),
  ...overrides,
});

describe('RETENTION_CONFIG', () => {
  it('has valid tier configurations', () => {
    expect(RETENTION_CONFIG.realtime.maxAge).toBe(24 * 60 * 60 * 1000);
    expect(RETENTION_CONFIG.realtime.promoteTo).toBe('hourly');

    expect(RETENTION_CONFIG.hourly.maxAge).toBe(7 * 24 * 60 * 60 * 1000);
    expect(RETENTION_CONFIG.hourly.promoteTo).toBe('daily');

    expect(RETENTION_CONFIG.daily.maxAge).toBe(90 * 24 * 60 * 60 * 1000);
    expect(RETENTION_CONFIG.daily.promoteTo).toBe('weekly');

    expect(RETENTION_CONFIG.weekly.maxAge).toBe(365 * 24 * 60 * 60 * 1000);
    expect(RETENTION_CONFIG.weekly.promoteTo).toBe('monthly');

    expect(RETENTION_CONFIG.monthly.maxAge).toBeNull();
    expect(RETENTION_CONFIG.monthly.promoteTo).toBeNull();

    expect(RETENTION_CONFIG.milestone.maxAge).toBeNull();
    expect(RETENTION_CONFIG.milestone.promoteTo).toBeNull();
  });

  it('defines all retention tiers', () => {
    const tiers: RetentionTier[] = [
      'realtime',
      'hourly',
      'daily',
      'weekly',
      'monthly',
      'milestone',
    ];
    for (const tier of tiers) {
      expect(RETENTION_CONFIG[tier]).toBeDefined();
    }
  });
});

describe('calculateExpirationDate', () => {
  const baseDate = new Date('2024-01-15T12:00:00.000Z');

  it('calculates expiration for realtime tier (24 hours)', () => {
    const expiration = calculateExpirationDate(baseDate, 'realtime');
    expect(expiration).toEqual(new Date('2024-01-16T12:00:00.000Z'));
  });

  it('calculates expiration for hourly tier (7 days)', () => {
    const expiration = calculateExpirationDate(baseDate, 'hourly');
    expect(expiration).toEqual(new Date('2024-01-22T12:00:00.000Z'));
  });

  it('calculates expiration for daily tier (90 days)', () => {
    const expiration = calculateExpirationDate(baseDate, 'daily');
    const expected = new Date(baseDate.getTime() + 90 * 24 * 60 * 60 * 1000);
    expect(expiration).toEqual(expected);
  });

  it('calculates expiration for weekly tier (1 year)', () => {
    const expiration = calculateExpirationDate(baseDate, 'weekly');
    const expected = new Date(baseDate.getTime() + 365 * 24 * 60 * 60 * 1000);
    expect(expiration).toEqual(expected);
  });

  it('returns null for monthly tier (never expires)', () => {
    const expiration = calculateExpirationDate(baseDate, 'monthly');
    expect(expiration).toBeNull();
  });

  it('returns null for milestone tier (never expires)', () => {
    const expiration = calculateExpirationDate(baseDate, 'milestone');
    expect(expiration).toBeNull();
  });
});

describe('shouldPromote', () => {
  it('promotes realtime snapshot older than 24 hours', () => {
    const snapshot = createSnapshot({
      retentionTier: 'realtime',
      capturedAt: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
    });
    expect(shouldPromote(snapshot)).toBe(true);
  });

  it('does not promote recent realtime snapshot', () => {
    const snapshot = createSnapshot({
      retentionTier: 'realtime',
      capturedAt: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
    });
    expect(shouldPromote(snapshot)).toBe(false);
  });

  it('promotes hourly snapshot older than 7 days', () => {
    const snapshot = createSnapshot({
      retentionTier: 'hourly',
      capturedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000), // 8 days ago
    });
    expect(shouldPromote(snapshot)).toBe(true);
  });

  it('does not promote recent hourly snapshot', () => {
    const snapshot = createSnapshot({
      retentionTier: 'hourly',
      capturedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
    });
    expect(shouldPromote(snapshot)).toBe(false);
  });

  it('promotes daily snapshot older than 90 days', () => {
    const snapshot = createSnapshot({
      retentionTier: 'daily',
      capturedAt: new Date(Date.now() - 91 * 24 * 60 * 60 * 1000), // 91 days ago
    });
    expect(shouldPromote(snapshot)).toBe(true);
  });

  it('promotes weekly snapshot older than 1 year', () => {
    const snapshot = createSnapshot({
      retentionTier: 'weekly',
      capturedAt: new Date(Date.now() - 366 * 24 * 60 * 60 * 1000), // 366 days ago
    });
    expect(shouldPromote(snapshot)).toBe(true);
  });

  it('never promotes monthly snapshots', () => {
    const snapshot = createSnapshot({
      retentionTier: 'monthly',
      capturedAt: new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000), // 5 years ago
    });
    expect(shouldPromote(snapshot)).toBe(false);
  });

  it('never promotes milestone snapshots', () => {
    const snapshot = createSnapshot({
      retentionTier: 'milestone',
      capturedAt: new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000), // 5 years ago
    });
    expect(shouldPromote(snapshot)).toBe(false);
  });
});

describe('detectMilestones', () => {
  describe('first sync milestones', () => {
    it('marks first sync as milestone when total level >= 500', () => {
      const current = createSnapshot({ totalLevel: 750 });
      const milestones = detectMilestones(null, current);

      expect(milestones).toHaveLength(1);
      expect(milestones[0]?.type).toBe('first_sync');
      expect(milestones[0]?.data['totalLevel']).toBe(750);
    });

    it('does not mark first sync when total level < 500', () => {
      const current = createSnapshot({ totalLevel: 300 });
      const milestones = detectMilestones(null, current);

      expect(milestones).toHaveLength(0);
    });
  });

  describe('level 99 milestones', () => {
    it('detects level 99 milestone', () => {
      const previous = createSnapshot({
        skills: [{ name: 'Cooking', level: 98, xp: 12034431, rank: 100000 }],
      });
      const current = createSnapshot({
        skills: [{ name: 'Cooking', level: 99, xp: 13034431, rank: 90000 }],
      });

      const milestones = detectMilestones(previous, current);

      expect(milestones).toHaveLength(1);
      expect(milestones[0]?.type).toBe('level_99');
      expect(milestones[0]?.data['skill']).toBe('Cooking');
    });

    it('detects multiple 99s in one snapshot', () => {
      const previous = createSnapshot({
        skills: [
          { name: 'Cooking', level: 98, xp: 12034431, rank: 100000 },
          { name: 'Firemaking', level: 98, xp: 12034431, rank: 100000 },
        ],
      });
      const current = createSnapshot({
        skills: [
          { name: 'Cooking', level: 99, xp: 13034431, rank: 90000 },
          { name: 'Firemaking', level: 99, xp: 13034431, rank: 90000 },
        ],
      });

      const milestones = detectMilestones(previous, current);

      expect(milestones).toHaveLength(2);
      const types = milestones.map((m) => m.type);
      expect(types).toEqual(['level_99', 'level_99']);
    });
  });

  describe('combat level milestones', () => {
    it('detects every 10 levels milestone for combat stats above 70', () => {
      const previous = createSnapshot({
        skills: [{ name: 'Attack', level: 79, xp: 1800000, rank: 300000 }],
      });
      const current = createSnapshot({
        skills: [{ name: 'Attack', level: 80, xp: 2000000, rank: 280000 }],
      });

      const milestones = detectMilestones(previous, current);

      expect(milestones).toHaveLength(1);
      expect(milestones[0]?.type).toBe('level_milestone');
      expect(milestones[0]?.data['skill']).toBe('Attack');
      expect(milestones[0]?.data['level']).toBe(80);
    });

    it('does not detect milestone for non-combat skills at 10s', () => {
      const previous = createSnapshot({
        skills: [{ name: 'Cooking', level: 79, xp: 1800000, rank: 300000 }],
      });
      const current = createSnapshot({
        skills: [{ name: 'Cooking', level: 80, xp: 2000000, rank: 280000 }],
      });

      const milestones = detectMilestones(previous, current);

      // Should not have level_milestone, cooking is not combat
      const levelMilestones = milestones.filter(
        (m) => m.type === 'level_milestone'
      );
      expect(levelMilestones).toHaveLength(0);
    });

    it('does not detect milestone for combat stats below 70', () => {
      const previous = createSnapshot({
        skills: [{ name: 'Attack', level: 59, xp: 250000, rank: 800000 }],
      });
      const current = createSnapshot({
        skills: [{ name: 'Attack', level: 60, xp: 273742, rank: 780000 }],
      });

      const milestones = detectMilestones(previous, current);
      const levelMilestones = milestones.filter(
        (m) => m.type === 'level_milestone'
      );
      expect(levelMilestones).toHaveLength(0);
    });
  });

  describe('total level milestones', () => {
    it('detects max total level (2277)', () => {
      const previous = createSnapshot({ totalLevel: 2276 });
      const current = createSnapshot({ totalLevel: 2277 });

      const milestones = detectMilestones(previous, current);

      expect(milestones.some((m) => m.type === 'max_total')).toBe(true);
    });

    it('detects every 250 milestone above 2000', () => {
      const previous = createSnapshot({ totalLevel: 2100 });
      const current = createSnapshot({ totalLevel: 2250 });

      const milestones = detectMilestones(previous, current);

      const totalMilestone = milestones.find(
        (m) => m.type === 'total_level_milestone'
      );
      expect(totalMilestone).toBeDefined();
      expect(totalMilestone?.data['totalLevel']).toBe(2250);
    });

    it('detects every 100 milestone between 1500-2000', () => {
      const previous = createSnapshot({ totalLevel: 1550 });
      const current = createSnapshot({ totalLevel: 1600 });

      const milestones = detectMilestones(previous, current);

      const totalMilestone = milestones.find(
        (m) => m.type === 'total_level_milestone'
      );
      expect(totalMilestone).toBeDefined();
      expect(totalMilestone?.data['totalLevel']).toBe(1600);
    });

    it('does not trigger milestone when no threshold crossed', () => {
      const previous = createSnapshot({ totalLevel: 1525 });
      const current = createSnapshot({ totalLevel: 1575 });

      const milestones = detectMilestones(previous, current);

      const totalMilestones = milestones.filter(
        (m) => m.type === 'total_level_milestone'
      );
      expect(totalMilestones).toHaveLength(0);
    });
  });

  describe('combat level milestones', () => {
    it('detects max combat (126)', () => {
      const previous = createSnapshot({ combatLevel: 125 });
      const current = createSnapshot({ combatLevel: 126 });

      const milestones = detectMilestones(previous, current);

      expect(milestones.some((m) => m.type === 'max_combat')).toBe(true);
    });

    it('detects combat level 100 milestone', () => {
      const previous = createSnapshot({ combatLevel: 99 });
      const current = createSnapshot({ combatLevel: 100 });

      const milestones = detectMilestones(previous, current);

      const combatMilestone = milestones.find(
        (m) => m.type === 'combat_milestone'
      );
      expect(combatMilestone).toBeDefined();
      expect(combatMilestone?.data['combatLevel']).toBe(100);
    });
  });

  describe('combined milestones', () => {
    it('detects multiple milestone types in one snapshot', () => {
      const previous = createSnapshot({
        totalLevel: 2275,
        combatLevel: 125,
        skills: [{ name: 'Cooking', level: 98, xp: 12034431, rank: 100000 }],
      });
      const current = createSnapshot({
        totalLevel: 2277,
        combatLevel: 126,
        skills: [{ name: 'Cooking', level: 99, xp: 13034431, rank: 90000 }],
      });

      const milestones = detectMilestones(previous, current);

      const types = milestones.map((m) => m.type);
      expect(types).toContain('level_99');
      expect(types).toContain('max_total');
      expect(types).toContain('max_combat');
    });
  });
});
