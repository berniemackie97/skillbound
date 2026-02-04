import { describe, expect, it } from 'vitest';

import { getXpForLevel } from '../data/xp-table';

import {
  calculateActionsNeeded,
  calculateActionPlan,
  calculateNextMilestone,
  calculateXpFromActions,
  calculateXpToLevel,
  calculateXpToTargetXp,
  estimateTimeToComplete,
  type XpAction,
} from './xp-calculator';

describe('calculateXpToLevel', () => {
  it('should calculate XP needed from level 1 to level 2', () => {
    const result = calculateXpToLevel(0, 2);

    expect(result.currentLevel).toBe(1);
    expect(result.currentXp).toBe(0);
    expect(result.targetLevel).toBe(2);
    expect(result.targetXp).toBe(83);
    expect(result.xpRemaining).toBe(83);
    expect(result.levelsRemaining).toBe(1);
    expect(result.progressPercentage).toBe(0);
  });

  it('should calculate XP needed from level 50 to level 60', () => {
    const level50Xp = getXpForLevel(50);
    const result = calculateXpToLevel(level50Xp, 60);

    expect(result.currentLevel).toBe(50);
    expect(result.targetLevel).toBe(60);
    expect(result.xpRemaining).toBeGreaterThan(0);
    expect(result.levelsRemaining).toBe(10);
  });

  it('should return 0 remaining if already at target', () => {
    const level50Xp = getXpForLevel(50);
    const result = calculateXpToLevel(level50Xp, 50);

    expect(result.xpRemaining).toBe(0);
    expect(result.levelsRemaining).toBe(0);
    expect(result.progressPercentage).toBe(100);
  });

  it('should return 0 remaining if past target', () => {
    const level60Xp = getXpForLevel(60);
    const result = calculateXpToLevel(level60Xp, 50);

    expect(result.xpRemaining).toBe(0);
    expect(result.levelsRemaining).toBe(0);
    expect(result.progressPercentage).toBe(100);
  });

  it('should calculate progress percentage correctly', () => {
    // Halfway between level 50 and 51
    const level50Xp = getXpForLevel(50);
    const level51Xp = getXpForLevel(51);
    const halfwayXp = level50Xp + (level51Xp - level50Xp) / 2;

    const result = calculateXpToLevel(halfwayXp, 51);

    expect(result.progressPercentage).toBeCloseTo(50, 0);
  });

  it('should throw error for negative XP', () => {
    expect(() => calculateXpToLevel(-1, 50)).toThrow();
  });

  it('should throw error for XP over max', () => {
    expect(() => calculateXpToLevel(200_000_001, 50)).toThrow();
  });

  it('should throw error for invalid target level', () => {
    expect(() => calculateXpToLevel(0, 0)).toThrow();
    expect(() => calculateXpToLevel(0, 100)).toThrow();
  });
});

describe('calculateXpToTargetXp', () => {
  it('should calculate XP needed to reach a target XP within same level', () => {
    const targetXp = 40;
    const result = calculateXpToTargetXp(0, targetXp);

    expect(result.currentLevel).toBe(1);
    expect(result.targetLevel).toBe(1);
    expect(result.xpRemaining).toBe(40);
    expect(result.progressPercentage).toBe(0);
  });

  it('should calculate XP needed to reach a higher target XP', () => {
    const targetXp = getXpForLevel(10);
    const result = calculateXpToTargetXp(0, targetXp);

    expect(result.targetLevel).toBe(10);
    expect(result.xpRemaining).toBe(targetXp);
    expect(result.levelsRemaining).toBe(9);
  });

  it('should return 0 remaining if already at target XP', () => {
    const targetXp = getXpForLevel(30);
    const result = calculateXpToTargetXp(targetXp, targetXp);

    expect(result.xpRemaining).toBe(0);
    expect(result.progressPercentage).toBe(100);
  });

  it('should throw error for invalid XP values', () => {
    expect(() => calculateXpToTargetXp(-1, 100)).toThrow();
    expect(() => calculateXpToTargetXp(0, 200_000_001)).toThrow();
  });
});

describe('calculateXpFromActions', () => {
  const burningLogs: XpAction = {
    name: 'Burning logs',
    xpPerAction: 40,
  };

  it('should calculate XP from single action', () => {
    const result = calculateXpFromActions(0, {
      ...burningLogs,
      actionsCompleted: 1,
    });

    expect(result.startLevel).toBe(1);
    expect(result.startXp).toBe(0);
    expect(result.xpGained).toBe(40);
    expect(result.endXp).toBe(40);
    expect(result.endLevel).toBe(1);
    expect(result.levelsGained).toBe(0);
  });

  it('should calculate XP from multiple actions', () => {
    const result = calculateXpFromActions(0, {
      ...burningLogs,
      actionsCompleted: 100,
    });

    expect(result.xpGained).toBe(4000);
    expect(result.endXp).toBe(4000);
    expect(result.endLevel).toBeGreaterThan(1);
  });

  it('should calculate level gains correctly', () => {
    const result = calculateXpFromActions(0, {
      name: 'High XP action',
      xpPerAction: 100000,
      actionsCompleted: 1,
    });

    expect(result.startLevel).toBe(1);
    expect(result.endLevel).toBeGreaterThan(1);
    expect(result.levelsGained).toBeGreaterThan(0);
  });

  it('should cap at max XP', () => {
    const result = calculateXpFromActions(199_000_000, {
      name: 'Massive XP',
      xpPerAction: 10_000_000,
      actionsCompleted: 1,
    });

    expect(result.endXp).toBe(200_000_000);
  });

  it('should default to 1 action if not specified', () => {
    const result = calculateXpFromActions(0, burningLogs);

    expect(result.xpGained).toBe(40);
  });

  it('should throw error for negative current XP', () => {
    expect(() => calculateXpFromActions(-1, burningLogs)).toThrow();
  });

  it('should throw error for non-positive XP per action', () => {
    expect(() =>
      calculateXpFromActions(0, { name: 'Invalid', xpPerAction: 0 })
    ).toThrow();
  });

  it('should throw error for negative actions', () => {
    expect(() =>
      calculateXpFromActions(0, { ...burningLogs, actionsCompleted: -1 })
    ).toThrow();
  });
});

describe('calculateActionPlan', () => {
  it('should apply multiple actions in sequence', () => {
    const plan = calculateActionPlan(0, [
      { name: 'Small action', xpPerAction: 40, actionsCompleted: 10 },
      { name: 'Bigger action', xpPerAction: 100, actionsCompleted: 5 },
    ]);

    expect(plan.actions).toHaveLength(2);
    expect(plan.startXp).toBe(0);
    expect(plan.totalXpGained).toBe(40 * 10 + 100 * 5);
    expect(plan.endXp).toBe(plan.totalXpGained);
    expect(plan.endLevel).toBeGreaterThanOrEqual(plan.startLevel);
  });

  it('should throw when action plan is empty', () => {
    expect(() => calculateActionPlan(0, [])).toThrow();
  });
});

describe('calculateActionsNeeded', () => {
  const dragonBones: XpAction = {
    name: 'Burying dragon bones',
    xpPerAction: 72,
  };

  it('should calculate actions needed to reach target', () => {
    const result = calculateActionsNeeded(0, 50, dragonBones);

    expect(result.currentLevel).toBe(1);
    expect(result.targetLevel).toBe(50);
    expect(result.xpRemaining).toBe(getXpForLevel(50));
    expect(result.actionsNeeded).toBe(
      Math.ceil(getXpForLevel(50) / dragonBones.xpPerAction)
    );
  });

  it('should return 0 actions if already at target', () => {
    const level50Xp = getXpForLevel(50);
    const result = calculateActionsNeeded(level50Xp, 50, dragonBones);

    expect(result.actionsNeeded).toBe(0);
    expect(result.xpRemaining).toBe(0);
  });

  it('should return 0 actions if past target', () => {
    const level60Xp = getXpForLevel(60);
    const result = calculateActionsNeeded(level60Xp, 50, dragonBones);

    expect(result.actionsNeeded).toBe(0);
  });

  it('should round up actions needed', () => {
    // 1000 XP needed, 3 XP per action = 333.33 actions -> 334
    const result = calculateActionsNeeded(0, 2, {
      name: 'Test',
      xpPerAction: 1,
    });

    const xpNeeded = getXpForLevel(2);
    expect(result.actionsNeeded).toBe(Math.ceil(xpNeeded));
  });

  it('should throw error for invalid inputs', () => {
    expect(() => calculateActionsNeeded(-1, 50, dragonBones)).toThrow();
    expect(() => calculateActionsNeeded(0, 0, dragonBones)).toThrow();
    expect(() =>
      calculateActionsNeeded(0, 50, { name: 'Test', xpPerAction: 0 })
    ).toThrow();
  });
});

describe('estimateTimeToComplete', () => {
  it('should estimate time correctly', () => {
    const result = estimateTimeToComplete(100, 10);

    expect(result.actionsNeeded).toBe(100);
    expect(result.estimatedSeconds).toBe(1000);
    expect(result.estimatedMinutes).toBeCloseTo(16.67, 1);
    expect(result.estimatedHours).toBeCloseTo(0.278, 2);
    expect(result.estimatedDays).toBeCloseTo(0.0116, 3);
  });

  it('should handle 0 actions', () => {
    const result = estimateTimeToComplete(0, 10);

    expect(result.estimatedSeconds).toBe(0);
    expect(result.estimatedMinutes).toBe(0);
    expect(result.estimatedHours).toBe(0);
    expect(result.estimatedDays).toBe(0);
  });

  it('should calculate days for long grinds', () => {
    // 10,000 actions at 30 seconds each
    const result = estimateTimeToComplete(10000, 30);

    expect(result.estimatedDays).toBeCloseTo(3.47, 1);
  });

  it('should throw error for negative actions', () => {
    expect(() => estimateTimeToComplete(-1, 10)).toThrow();
  });

  it('should throw error for non-positive seconds per action', () => {
    expect(() => estimateTimeToComplete(100, 0)).toThrow();
    expect(() => estimateTimeToComplete(100, -1)).toThrow();
  });
});

describe('calculateNextMilestone', () => {
  it('should find next milestone from level 1', () => {
    const result = calculateNextMilestone(0);

    expect(result.currentLevel).toBe(1);
    expect(result.nextMilestone).toBe(5);
    expect(result.nextMilestoneXp).toBe(getXpForLevel(5));
  });

  it('should find next milestone from level 42', () => {
    const level42Xp = getXpForLevel(42);
    const result = calculateNextMilestone(level42Xp);

    expect(result.currentLevel).toBe(42);
    expect(result.nextMilestone).toBe(45);
  });

  it('should find next milestone from level 48', () => {
    const level48Xp = getXpForLevel(48);
    const result = calculateNextMilestone(level48Xp);

    expect(result.currentLevel).toBe(48);
    expect(result.nextMilestone).toBe(50);
  });

  it('should handle level 50 milestone', () => {
    const level50Xp = getXpForLevel(50);
    const result = calculateNextMilestone(level50Xp);

    expect(result.currentLevel).toBe(50);
    expect(result.nextMilestone).toBe(55);
  });

  it('should return 99 as final milestone', () => {
    const level98Xp = getXpForLevel(98);
    const result = calculateNextMilestone(level98Xp);

    expect(result.nextMilestone).toBe(99);
  });

  it('should return 99 when already at 99', () => {
    const level99Xp = getXpForLevel(99);
    const result = calculateNextMilestone(level99Xp);

    expect(result.currentLevel).toBe(99);
    expect(result.nextMilestone).toBe(99);
    expect(result.xpToMilestone).toBe(0);
    expect(result.progressPercentage).toBe(100);
  });

  it('should calculate progress percentage', () => {
    // At exactly level 40, progress toward 45 should be 0%
    const level40Xp = getXpForLevel(40);
    const result40 = calculateNextMilestone(level40Xp);
    expect(result40.currentLevel).toBe(40);
    expect(result40.nextMilestone).toBe(45);
    expect(result40.progressPercentage).toBe(0);

    // Partway through level 41 toward milestone 45
    const level41Xp = getXpForLevel(41);
    const level42Xp = getXpForLevel(42);
    const halfwayToLevel42 = level41Xp + (level42Xp - level41Xp) / 2;

    const resultMid = calculateNextMilestone(halfwayToLevel42);
    expect(resultMid.currentLevel).toBe(41);
    expect(resultMid.nextMilestone).toBe(45);
    expect(resultMid.progressPercentage).toBeGreaterThan(0);
    expect(resultMid.progressPercentage).toBeLessThan(100);
  });

  it('should throw error for invalid XP', () => {
    expect(() => calculateNextMilestone(-1)).toThrow();
    expect(() => calculateNextMilestone(200_000_001)).toThrow();
  });
});

describe('Integration tests', () => {
  it('should calculate complete training plan', () => {
    const startXp = 0;
    const targetLevel = 50;
    const action: XpAction = {
      name: 'Cooking lobsters',
      xpPerAction: 120,
    };

    // Calculate what's needed
    const plan = calculateActionsNeeded(startXp, targetLevel, action);

    // Verify we can achieve it
    const result = calculateXpFromActions(startXp, {
      ...action,
      actionsCompleted: plan.actionsNeeded,
    });

    expect(result.endLevel).toBeGreaterThanOrEqual(targetLevel);
  });

  it('should handle realistic prayer training scenario', () => {
    const startXp = getXpForLevel(43); // Level 43 Prayer
    const targetLevel = 70;
    const dragonBones: XpAction = {
      name: 'Dragon bones on gilded altar',
      xpPerAction: 252, // 72 * 3.5 with both burners
    };

    const plan = calculateActionsNeeded(startXp, targetLevel, dragonBones);
    const timeEstimate = estimateTimeToComplete(plan.actionsNeeded, 5);

    expect(plan.actionsNeeded).toBeGreaterThan(0);
    expect(timeEstimate.estimatedHours).toBeGreaterThan(0);
  });
});
