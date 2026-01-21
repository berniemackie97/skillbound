import {
  getLevelForXp,
  getXpBetweenLevels,
  getXpForLevel,
  MAX_LEVEL,
  MAX_XP,
} from '../data/xp-table';

/**
 * Result of an XP calculation
 */
export interface XpCalculationResult {
  readonly currentLevel: number;
  readonly currentXp: number;
  readonly targetLevel: number;
  readonly targetXp: number;
  readonly xpRemaining: number;
  readonly levelsRemaining: number;
  readonly progressPercentage: number;
}

/**
 * Calculate XP needed to reach a target level from current XP
 */
export function calculateXpToLevel(
  currentXp: number,
  targetLevel: number
): XpCalculationResult {
  if (currentXp < 0 || currentXp > MAX_XP) {
    throw new Error(`Current XP must be between 0 and ${MAX_XP}`);
  }

  if (targetLevel < 1 || targetLevel > MAX_LEVEL) {
    throw new Error(`Target level must be between 1 and ${MAX_LEVEL}`);
  }

  const currentLevel = getLevelForXp(currentXp);

  if (currentLevel >= targetLevel) {
    // Already at or past target
    return {
      currentLevel,
      currentXp,
      targetLevel,
      targetXp: getXpForLevel(targetLevel),
      xpRemaining: 0,
      levelsRemaining: 0,
      progressPercentage: 100,
    };
  }

  const targetXp = getXpForLevel(targetLevel);
  const xpRemaining = targetXp - currentXp;
  const levelsRemaining = targetLevel - currentLevel;
  const totalXpNeeded = getXpBetweenLevels(currentLevel, targetLevel);
  const xpGained = currentXp - getXpForLevel(currentLevel);
  const progressPercentage = (xpGained / totalXpNeeded) * 100;

  return {
    currentLevel,
    currentXp,
    targetLevel,
    targetXp,
    xpRemaining,
    levelsRemaining,
    progressPercentage,
  };
}

/**
 * Action that grants XP
 */
export interface XpAction {
  readonly name: string;
  readonly xpPerAction: number;
  readonly actionsCompleted?: number;
}

/**
 * Result of an action-based XP calculation
 */
export interface ActionCalculationResult {
  readonly action: XpAction;
  readonly startLevel: number;
  readonly startXp: number;
  readonly xpGained: number;
  readonly endLevel: number;
  readonly endXp: number;
  readonly levelsGained: number;
}

/**
 * Calculate XP gained from performing actions
 */
export function calculateXpFromActions(
  currentXp: number,
  action: XpAction
): ActionCalculationResult {
  if (currentXp < 0 || currentXp > MAX_XP) {
    throw new Error(`Current XP must be between 0 and ${MAX_XP}`);
  }

  if (action.xpPerAction <= 0) {
    throw new Error('XP per action must be positive');
  }

  const actionsCompleted = action.actionsCompleted ?? 1;

  if (actionsCompleted < 0) {
    throw new Error('Actions completed cannot be negative');
  }

  const startLevel = getLevelForXp(currentXp);
  const xpGained = action.xpPerAction * actionsCompleted;
  const endXp = Math.min(currentXp + xpGained, MAX_XP);
  const endLevel = getLevelForXp(endXp);
  const levelsGained = endLevel - startLevel;

  return {
    action,
    startLevel,
    startXp: currentXp,
    xpGained,
    endLevel,
    endXp,
    levelsGained,
  };
}

/**
 * Calculate actions needed to reach target
 */
export interface ActionsNeededResult {
  readonly currentLevel: number;
  readonly currentXp: number;
  readonly targetLevel: number;
  readonly targetXp: number;
  readonly xpRemaining: number;
  readonly actionsNeeded: number;
  readonly action: XpAction;
}

/**
 * Calculate how many actions are needed to reach a target level
 */
export function calculateActionsNeeded(
  currentXp: number,
  targetLevel: number,
  action: XpAction
): ActionsNeededResult {
  if (currentXp < 0 || currentXp > MAX_XP) {
    throw new Error(`Current XP must be between 0 and ${MAX_XP}`);
  }

  if (targetLevel < 1 || targetLevel > MAX_LEVEL) {
    throw new Error(`Target level must be between 1 and ${MAX_LEVEL}`);
  }

  if (action.xpPerAction <= 0) {
    throw new Error('XP per action must be positive');
  }

  const currentLevel = getLevelForXp(currentXp);
  const targetXp = getXpForLevel(targetLevel);

  if (currentLevel >= targetLevel) {
    // Already at target
    return {
      currentLevel,
      currentXp,
      targetLevel,
      targetXp,
      xpRemaining: 0,
      actionsNeeded: 0,
      action,
    };
  }

  const xpRemaining = targetXp - currentXp;
  const actionsNeeded = Math.ceil(xpRemaining / action.xpPerAction);

  return {
    currentLevel,
    currentXp,
    targetLevel,
    targetXp,
    xpRemaining,
    actionsNeeded,
    action,
  };
}

/**
 * Time estimation result
 */
export interface TimeEstimationResult {
  readonly actionsNeeded: number;
  readonly estimatedSeconds: number;
  readonly estimatedMinutes: number;
  readonly estimatedHours: number;
  readonly estimatedDays: number;
}

/**
 * Estimate time to complete actions
 */
export function estimateTimeToComplete(
  actionsNeeded: number,
  secondsPerAction: number
): TimeEstimationResult {
  if (actionsNeeded < 0) {
    throw new Error('Actions needed cannot be negative');
  }

  if (secondsPerAction <= 0) {
    throw new Error('Seconds per action must be positive');
  }

  const estimatedSeconds = actionsNeeded * secondsPerAction;
  const estimatedMinutes = estimatedSeconds / 60;
  const estimatedHours = estimatedMinutes / 60;
  const estimatedDays = estimatedHours / 24;

  return {
    actionsNeeded,
    estimatedSeconds,
    estimatedMinutes,
    estimatedHours,
    estimatedDays,
  };
}

/**
 * Calculate next level milestone
 */
export interface NextMilestoneResult {
  readonly currentLevel: number;
  readonly currentXp: number;
  readonly nextMilestone: number;
  readonly nextMilestoneXp: number;
  readonly xpToMilestone: number;
  readonly progressPercentage: number;
}

/**
 * Get next milestone (next multiple of 5 or 10)
 */
export function calculateNextMilestone(currentXp: number): NextMilestoneResult {
  if (currentXp < 0 || currentXp > MAX_XP) {
    throw new Error(`Current XP must be between 0 and ${MAX_XP}`);
  }

  const currentLevel = getLevelForXp(currentXp);

  if (currentLevel >= MAX_LEVEL) {
    // Already maxed
    return {
      currentLevel,
      currentXp,
      nextMilestone: MAX_LEVEL,
      nextMilestoneXp: getXpForLevel(MAX_LEVEL),
      xpToMilestone: 0,
      progressPercentage: 100,
    };
  }

  // Find next milestone (next level ending in 0 or 5)
  let nextMilestone = currentLevel + 1;
  while (nextMilestone <= MAX_LEVEL && nextMilestone % 5 !== 0) {
    nextMilestone++;
  }

  if (nextMilestone > MAX_LEVEL) {
    nextMilestone = MAX_LEVEL;
  }

  const nextMilestoneXp = getXpForLevel(nextMilestone);
  const xpToMilestone = nextMilestoneXp - currentXp;
  const totalXpForRange = getXpBetweenLevels(currentLevel, nextMilestone);
  const xpGainedInRange = currentXp - getXpForLevel(currentLevel);
  const progressPercentage = (xpGainedInRange / totalXpForRange) * 100;

  return {
    currentLevel,
    currentXp,
    nextMilestone,
    nextMilestoneXp,
    xpToMilestone,
    progressPercentage,
  };
}
