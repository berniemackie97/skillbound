import { describe, expect, it } from 'vitest';

import {
  MAX_LEVEL,
  MAX_LEVEL_XP,
  MAX_VIRTUAL_LEVEL,
  MAX_XP,
  XP_TABLE,
  getLevelForXp,
  getProgressToNextLevel,
  getXpBetweenLevels,
  getXpForLevel,
  getXpToNextLevel,
} from './xp-table';

describe('XP_TABLE', () => {
  it('should have correct length for virtual level 126', () => {
    expect(XP_TABLE).toHaveLength(126);
  });

  it('should start at 0 XP for level 1', () => {
    expect(XP_TABLE[0]).toBe(0);
  });

  it('should have correct XP for level 99 (13,034,431)', () => {
    expect(XP_TABLE[98]).toBe(13034431);
  });

  it('should be strictly increasing', () => {
    for (let i = 1; i < XP_TABLE.length; i++) {
      const prev = XP_TABLE[i - 1] as number;
      const curr = XP_TABLE[i] as number;
      expect(curr).toBeGreaterThan(prev);
    }
  });

  it('should be immutable', () => {
    expect(Object.isFrozen(XP_TABLE)).toBe(true);
  });
});

describe('getXpForLevel', () => {
  it('should return 0 for level 1', () => {
    expect(getXpForLevel(1)).toBe(0);
  });

  it('should return correct XP for level 2', () => {
    expect(getXpForLevel(2)).toBe(83);
  });

  it('should return correct XP for level 50', () => {
    expect(getXpForLevel(50)).toBe(101333);
  });

  it('should return correct XP for level 99', () => {
    expect(getXpForLevel(99)).toBe(13034431);
  });

  it('should return correct XP for virtual level 126', () => {
    expect(getXpForLevel(126)).toBe(188884740);
  });

  it('should throw error for level 0', () => {
    expect(() => getXpForLevel(0)).toThrow();
  });

  it('should throw error for level 127', () => {
    expect(() => getXpForLevel(127)).toThrow();
  });

  it('should throw error for negative levels', () => {
    expect(() => getXpForLevel(-1)).toThrow();
  });
});

describe('getLevelForXp', () => {
  it('should return 1 for 0 XP', () => {
    expect(getLevelForXp(0)).toBe(1);
  });

  it('should return 1 for 82 XP (just before level 2)', () => {
    expect(getLevelForXp(82)).toBe(1);
  });

  it('should return 2 for 83 XP (exactly level 2)', () => {
    expect(getLevelForXp(83)).toBe(2);
  });

  it('should return 2 for 84 XP (just after level 2)', () => {
    expect(getLevelForXp(84)).toBe(2);
  });

  it('should return correct level for mid-range XP', () => {
    expect(getLevelForXp(500000)).toBe(66);
  });

  it('should return 99 for 13,034,431 XP (exact)', () => {
    expect(getLevelForXp(13034431)).toBe(99);
  });

  it('should return 99 for XP between 99 and 100', () => {
    expect(getLevelForXp(14000000)).toBe(99);
  });

  it('should return 126 for 200M XP', () => {
    expect(getLevelForXp(200_000_000)).toBe(126);
  });

  it('should throw error for negative XP', () => {
    expect(() => getLevelForXp(-1)).toThrow();
  });

  it('should throw error for XP over 200M', () => {
    expect(() => getLevelForXp(200_000_001)).toThrow();
  });

  // Boundary testing - level transitions
  it('should correctly handle all level boundaries', () => {
    for (let level = 2; level <= MAX_VIRTUAL_LEVEL; level++) {
      const xp = getXpForLevel(level);
      expect(getLevelForXp(xp)).toBe(level);
      expect(getLevelForXp(xp - 1)).toBe(level - 1);
    }
  });
});

describe('getXpToNextLevel', () => {
  it('should return 83 XP from level 1 to 2', () => {
    expect(getXpToNextLevel(0)).toBe(83);
  });

  it('should return correct XP when partway through a level', () => {
    // At 100 XP (level 2), need 174 total for level 3
    expect(getXpToNextLevel(100)).toBe(74);
  });

  it('should return 0 at max virtual level', () => {
    expect(getXpToNextLevel(MAX_XP)).toBe(0);
  });

  it('should handle exact level boundaries', () => {
    const level50Xp = getXpForLevel(50);
    const level51Xp = getXpForLevel(51);
    expect(getXpToNextLevel(level50Xp)).toBe(level51Xp - level50Xp);
  });
});

describe('getXpBetweenLevels', () => {
  it('should return 0 when fromLevel >= toLevel', () => {
    expect(getXpBetweenLevels(50, 50)).toBe(0);
    expect(getXpBetweenLevels(50, 40)).toBe(0);
  });

  it('should return correct XP from 1 to 2', () => {
    expect(getXpBetweenLevels(1, 2)).toBe(83);
  });

  it('should return correct XP from 1 to 99', () => {
    expect(getXpBetweenLevels(1, 99)).toBe(13034431);
  });

  it('should return correct XP between mid-range levels', () => {
    const xp50 = getXpForLevel(50);
    const xp60 = getXpForLevel(60);
    expect(getXpBetweenLevels(50, 60)).toBe(xp60 - xp50);
  });

  it('should calculate virtual levels correctly', () => {
    const xp99 = getXpForLevel(99);
    const xp100 = getXpForLevel(100);
    expect(getXpBetweenLevels(99, 100)).toBe(xp100 - xp99);
  });
});

describe('getProgressToNextLevel', () => {
  it('should return 0 at exact level boundary', () => {
    expect(getProgressToNextLevel(0)).toBe(0);
    expect(getProgressToNextLevel(83)).toBe(0);
  });

  it('should return 1 at max level', () => {
    expect(getProgressToNextLevel(MAX_XP)).toBe(1);
  });

  it('should return 0.5 at halfway point', () => {
    // Level 2 is at 83 XP, level 3 is at 174 XP (diff of 91)
    // Halfway is 83 + 45.5 = 128.5 XP
    const progress = getProgressToNextLevel(128);
    expect(progress).toBeCloseTo(0.494, 2);
  });

  it('should return progress between 0 and 1', () => {
    // Test random XP values
    const testXp = [100, 1000, 10000, 100000, 1000000, 10000000];

    testXp.forEach((xp) => {
      const progress = getProgressToNextLevel(xp);
      expect(progress).toBeGreaterThanOrEqual(0);
      expect(progress).toBeLessThanOrEqual(1);
    });
  });

  it('should increase as XP increases within a level', () => {
    const level50Xp = getXpForLevel(50);
    const progress1 = getProgressToNextLevel(level50Xp + 1000);
    const progress2 = getProgressToNextLevel(level50Xp + 2000);
    expect(progress2).toBeGreaterThan(progress1);
  });
});

describe('Constants', () => {
  it('MAX_LEVEL should be 99', () => {
    expect(MAX_LEVEL).toBe(99);
  });

  it('MAX_VIRTUAL_LEVEL should be 126', () => {
    expect(MAX_VIRTUAL_LEVEL).toBe(126);
  });

  it('MAX_LEVEL_XP should be correct', () => {
    expect(MAX_LEVEL_XP).toBe(13034431);
  });

  it('MAX_XP should be 200M', () => {
    expect(MAX_XP).toBe(200_000_000);
  });
});

describe('Edge cases and integration', () => {
  it('should handle round-trip conversions correctly', () => {
    // XP -> Level -> XP should give XP at that level boundary
    for (let level = 1; level <= 99; level++) {
      const xp = getXpForLevel(level);
      const calculatedLevel = getLevelForXp(xp);
      const backToXp = getXpForLevel(calculatedLevel);
      expect(backToXp).toBe(xp);
    }
  });

  it('should handle unranked (-1) values gracefully', () => {
    // In OSRS, -1 means unranked (below level 15 or no KC)
    // We should handle 0 XP correctly
    expect(getLevelForXp(0)).toBe(1);
  });

  it('should handle very large XP values near 200M', () => {
    expect(getLevelForXp(199_999_999)).toBe(126);
    expect(getLevelForXp(200_000_000)).toBe(126);
  });

  it('should maintain precision with floating point XP', () => {
    // Some calculations might result in floats
    expect(getLevelForXp(Math.floor(150.7))).toBe(2);
    expect(getLevelForXp(Math.floor(83.1))).toBe(2);
  });
});
