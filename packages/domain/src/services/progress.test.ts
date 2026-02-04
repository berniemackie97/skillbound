import { describe, expect, it } from 'vitest';

import type { ProgressSnapshot, SkillSnapshot } from '../types/progress';
import { SKILLS } from '../types/skills';

import {
  calculateCombatLevel,
  calculateTotalLevel,
  calculateTotalXp,
  diffSnapshots,
} from './progress';

function baseSkills(
  overrides: Partial<Record<string, Partial<SkillSnapshot>>> = {}
) {
  return SKILLS.map((name) => {
    const override = overrides[name] ?? {};
    return {
      name,
      level: override.level ?? 1,
      xp: override.xp ?? 0,
    } as SkillSnapshot;
  });
}

describe('progress utilities', () => {
  it('calculates combat level using OSRS formula', () => {
    const combat = calculateCombatLevel({
      attack: 1,
      strength: 1,
      defence: 1,
      hitpoints: 10,
      prayer: 1,
      ranged: 1,
      magic: 1,
    });

    expect(combat).toBe(3);
  });

  it('calculates total level and xp', () => {
    const skills = baseSkills({
      attack: { level: 10, xp: 1154 },
      strength: { level: 10, xp: 1154 },
    });

    const totalLevel = calculateTotalLevel(skills);
    const totalXp = calculateTotalXp(skills);

    expect(totalLevel).toBe(10 + 10 + (SKILLS.length - 2) * 1);
    expect(totalXp).toBe(1154 + 1154);
  });

  it('diffs snapshots with skill and activity deltas', () => {
    const previous: ProgressSnapshot = {
      capturedAt: '2026-01-01T00:00:00.000Z',
      totalLevel: 50,
      totalXp: 1000,
      combatLevel: 10,
      skills: baseSkills({
        attack: { level: 5, xp: 500 },
      }),
      activities: { zulrah: 5 },
    };

    const current: ProgressSnapshot = {
      capturedAt: '2026-01-10T00:00:00.000Z',
      totalLevel: 55,
      totalXp: 1600,
      combatLevel: 12,
      skills: baseSkills({
        attack: { level: 7, xp: 900 },
      }),
      activities: { zulrah: 8, vorkath: 2 },
    };

    const diff = diffSnapshots(previous, current);

    expect(diff.totalLevelDelta).toBe(5);
    expect(diff.totalXpDelta).toBe(600);
    expect(diff.combatLevelDelta).toBe(2);
    expect(diff.skillDeltas.attack.levelDelta).toBe(2);
    expect(diff.skillDeltas.attack.xpDelta).toBe(400);
    expect(diff.activityDeltas['zulrah']).toBe(3);
    expect(diff.activityDeltas['vorkath']).toBe(2);
  });
});
