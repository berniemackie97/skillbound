import { calculateCombatLevel } from '../services/progress';
import { COMBAT_SKILLS, type SkillData, type SkillName } from '../types/skills';

import type {
  CharacterFacts,
  Requirement,
  RequirementResult,
  RequirementStatus,
  SkillLevelInput,
  SkillShortfall,
} from './types';

function resolveBoolean(value: boolean | null | undefined): RequirementStatus {
  if (value === true) {
    return 'MET';
  }
  if (value === false) {
    return 'NOT_MET';
  }
  // Only null is truly unknown - undefined means we have data and it's not completed
  if (value === null) {
    return 'UNKNOWN';
  }
  // undefined means not in the facts object - treat as not met when we have data
  return 'NOT_MET';
}

function resolveSkillLevel(
  input: SkillLevelInput | null | undefined
): number | null {
  if (input === null || input === undefined) {
    return null;
  }

  if (typeof input === 'number') {
    return Number.isFinite(input) ? input : null;
  }

  const skillData: SkillData = input;
  return Number.isFinite(skillData.level) ? skillData.level : null;
}

export function getDiaryKey(diaryId: string, tier: string): string {
  return `${diaryId}:${tier}`;
}

export function getDiaryTaskKey(
  diaryId: string,
  tier: string,
  taskId: string
): string {
  return `${diaryId}:${tier}:${taskId}`;
}

export function evaluateRequirement(
  requirement: Requirement,
  facts: CharacterFacts
): RequirementResult {
  switch (requirement.type) {
    case 'skill-level': {
      const level = resolveSkillLevel(facts.skillLevels?.[requirement.skill]);
      if (level === null) {
        return { requirement, status: 'UNKNOWN' };
      }

      if (level >= requirement.level) {
        return { requirement, status: 'MET' };
      }

      const shortfall: SkillShortfall = {
        currentLevel: level,
        requiredLevel: requirement.level,
        levelsNeeded: Math.max(0, requirement.level - level),
      };

      return { requirement, status: 'NOT_MET', shortfall };
    }
    case 'quest-complete': {
      const status = resolveBoolean(facts.quests?.[requirement.questId]);
      return { requirement, status };
    }
    case 'diary-complete': {
      const key = getDiaryKey(requirement.diaryId, requirement.tier);
      const status = resolveBoolean(facts.diaries?.[key]);
      return { requirement, status };
    }
    case 'diary-task': {
      const key = getDiaryTaskKey(
        requirement.diaryId,
        requirement.tier,
        requirement.taskId
      );
      const status = resolveBoolean(facts.diaryTasks?.[key]);
      return { requirement, status };
    }
    case 'unlock-flag': {
      const status = resolveBoolean(facts.unlocks?.[requirement.flagId]);
      return { requirement, status };
    }
    case 'activity-score': {
      const score = facts.activities?.[requirement.activityKey];
      if (score === null || score === undefined) {
        return { requirement, status: 'UNKNOWN' };
      }
      if (!Number.isFinite(score)) {
        return { requirement, status: 'UNKNOWN' };
      }
      if (score >= requirement.score) {
        return { requirement, status: 'MET' };
      }
      return { requirement, status: 'NOT_MET' };
    }
    case 'combined-skill-level': {
      const levels: number[] = [];
      for (const skill of requirement.skills) {
        const level = resolveSkillLevel(facts.skillLevels?.[skill]);
        if (level === null) {
          return { requirement, status: 'UNKNOWN' };
        }
        levels.push(level);
      }
      const total = levels.reduce((sum, level) => sum + level, 0);
      if (total >= requirement.totalLevel) {
        return { requirement, status: 'MET' };
      }
      return { requirement, status: 'NOT_MET' };
    }
    case 'combat-level': {
      const combatLevels = COMBAT_SKILLS.map((skill) =>
        resolveSkillLevel(facts.skillLevels?.[skill])
      );
      if (combatLevels.some((level) => level === null)) {
        return { requirement, status: 'UNKNOWN' };
      }
      const levelMap = COMBAT_SKILLS.reduce<Record<SkillName, number>>(
        (acc, skill, index) => {
          acc[skill] = combatLevels[index] ?? 1;
          return acc;
        },
        {} as Record<SkillName, number>
      );
      const combatLevel = calculateCombatLevel(levelMap);
      if (combatLevel >= requirement.level) {
        return { requirement, status: 'MET' };
      }
      return { requirement, status: 'NOT_MET' };
    }
    case 'combat-achievement': {
      const status = resolveBoolean(
        facts.combatAchievements?.[requirement.achievementId]
      );
      return { requirement, status };
    }
    case 'item-possessed': {
      const value = facts.items?.[requirement.itemId];
      if (value === true) {
        return { requirement, status: 'MET' };
      }
      if (value === false) {
        return { requirement, status: 'NOT_MET' };
      }
      return { requirement, status: 'UNKNOWN' };
    }
    case 'manual-check': {
      return { requirement, status: 'UNKNOWN' };
    }
    case 'all-of': {
      if (requirement.requirements.length === 0) {
        return { requirement, status: 'MET', children: [] };
      }

      const children = requirement.requirements.map((child) =>
        evaluateRequirement(child, facts)
      );
      const status = summarizeStatuses(children.map((child) => child.status));
      return { requirement, status, children };
    }
    case 'any-of': {
      if (requirement.requirements.length === 0) {
        return { requirement, status: 'NOT_MET', children: [] };
      }

      const children = requirement.requirements.map((child) =>
        evaluateRequirement(child, facts)
      );
      const status = summarizeAnyStatuses(
        children.map((child) => child.status)
      );
      return { requirement, status, children };
    }
    default: {
      const exhaustive: never = requirement;
      return { requirement: exhaustive, status: 'UNKNOWN' };
    }
  }
}

export function evaluateRequirements(
  requirements: Requirement[],
  facts: CharacterFacts
): RequirementResult[] {
  return requirements.map((requirement) =>
    evaluateRequirement(requirement, facts)
  );
}

export function summarizeStatuses(
  statuses: RequirementStatus[]
): RequirementStatus {
  if (statuses.includes('NOT_MET')) {
    return 'NOT_MET';
  }
  if (statuses.includes('UNKNOWN')) {
    return 'UNKNOWN';
  }
  return 'MET';
}

export function summarizeAnyStatuses(
  statuses: RequirementStatus[]
): RequirementStatus {
  if (statuses.includes('MET')) {
    return 'MET';
  }
  if (statuses.includes('UNKNOWN')) {
    return 'UNKNOWN';
  }
  return 'NOT_MET';
}

export function evaluateRequirementSet(
  required: Requirement[],
  optional: Requirement[] | undefined,
  facts: CharacterFacts
): {
  required: RequirementResult[];
  optional: RequirementResult[];
  status: RequirementStatus;
} {
  const requiredResults = evaluateRequirements(required, facts);
  const optionalResults = optional ? evaluateRequirements(optional, facts) : [];

  return {
    required: requiredResults,
    optional: optionalResults,
    status: summarizeStatuses(requiredResults.map((result) => result.status)),
  };
}

export function getSkillShortfall(
  skill: SkillName,
  requiredLevel: number,
  facts: CharacterFacts
): SkillShortfall | null {
  const level = resolveSkillLevel(facts.skillLevels?.[skill]);
  if (level === null) {
    return null;
  }

  if (level >= requiredLevel) {
    return { currentLevel: level, requiredLevel, levelsNeeded: 0 };
  }

  return {
    currentLevel: level,
    requiredLevel,
    levelsNeeded: Math.max(0, requiredLevel - level),
  };
}
