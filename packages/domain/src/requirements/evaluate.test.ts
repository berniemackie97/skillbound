import { describe, expect, it } from 'vitest';

import {
  evaluateRequirement,
  evaluateRequirementSet,
  getDiaryKey,
  getDiaryTaskKey,
  getSkillShortfall,
  summarizeAnyStatuses,
  summarizeStatuses,
} from './evaluate';
import type { CharacterFacts, Requirement } from './types';

const facts: CharacterFacts = {
  skillLevels: {
    attack: { name: 'attack', level: 70, xp: 737627 },
    strength: 70,
    defence: 70,
    hitpoints: 70,
    prayer: 70,
    ranged: 70,
    magic: 60,
  },
  quests: {
    cooks_assistant: true,
    dragon_slayer: false,
  },
  diaries: {
    [getDiaryKey('varrock', 'easy')]: true,
  },
  diaryTasks: {
    [getDiaryTaskKey('varrock', 'easy', 'speak_to_benny')]: false,
  },
  unlocks: {
    fairy_rings: true,
  },
  combatAchievements: {
    barrows_novice: true,
    noxious_foe: false,
  },
  activities: {
    barrows: 12,
    zulrah: 0,
  },
  items: {
    4151: true,
    11840: false,
  },
};

describe('evaluateRequirement', () => {
  it('marks skill requirements as met', () => {
    const requirement: Requirement = {
      type: 'skill-level',
      skill: 'attack',
      level: 60,
    };
    const result = evaluateRequirement(requirement, facts);

    expect(result.status).toBe('MET');
  });

  it('returns shortfall for unmet skill requirements', () => {
    const requirement: Requirement = {
      type: 'skill-level',
      skill: 'magic',
      level: 70,
    };
    const result = evaluateRequirement(requirement, facts);

    expect(result.status).toBe('NOT_MET');
    expect(result.shortfall?.levelsNeeded).toBe(10);
  });

  it('returns unknown when skill data is missing', () => {
    const missingFacts: CharacterFacts = {
      ...facts,
      skillLevels: {
        attack: { name: 'attack', level: 70, xp: 737627 },
      },
    };
    const requirement: Requirement = {
      type: 'skill-level',
      skill: 'defence',
      level: 1,
    };
    const result = evaluateRequirement(requirement, missingFacts);

    expect(result.status).toBe('UNKNOWN');
  });

  it('evaluates quest requirements', () => {
    const requirement: Requirement = {
      type: 'quest-complete',
      questId: 'cooks_assistant',
    };
    const result = evaluateRequirement(requirement, facts);

    expect(result.status).toBe('MET');
  });

  it('evaluates diary requirements', () => {
    const requirement: Requirement = {
      type: 'diary-complete',
      diaryId: 'varrock',
      tier: 'easy',
    };
    const result = evaluateRequirement(requirement, facts);

    expect(result.status).toBe('MET');
  });

  it('evaluates diary tasks', () => {
    const requirement: Requirement = {
      type: 'diary-task',
      diaryId: 'varrock',
      tier: 'easy',
      taskId: 'speak_to_benny',
    };
    const result = evaluateRequirement(requirement, facts);

    expect(result.status).toBe('NOT_MET');
  });

  it('evaluates item requirements', () => {
    const requirement: Requirement = { type: 'item-possessed', itemId: 4151 };
    const result = evaluateRequirement(requirement, facts);

    expect(result.status).toBe('MET');
  });

  it('evaluates unlock requirements', () => {
    const requirement: Requirement = {
      type: 'unlock-flag',
      flagId: 'fairy_rings',
    };
    const result = evaluateRequirement(requirement, facts);

    expect(result.status).toBe('MET');
  });

  it('evaluates activity score requirements', () => {
    const requirement: Requirement = {
      type: 'activity-score',
      activityKey: 'barrows',
      score: 10,
    };
    const result = evaluateRequirement(requirement, facts);

    expect(result.status).toBe('MET');
  });

  it('returns unknown when activity score is missing', () => {
    const requirement: Requirement = {
      type: 'activity-score',
      activityKey: 'unknown_activity',
      score: 1,
    };
    const result = evaluateRequirement(requirement, facts);

    expect(result.status).toBe('UNKNOWN');
  });

  it('evaluates combat achievement requirements', () => {
    const requirement: Requirement = {
      type: 'combat-achievement',
      achievementId: 'barrows_novice',
    };
    const result = evaluateRequirement(requirement, facts);

    expect(result.status).toBe('MET');
  });

  it('evaluates combined skill level requirements', () => {
    const requirement: Requirement = {
      type: 'combined-skill-level',
      skills: ['attack', 'strength'],
      totalLevel: 120,
    };
    const result = evaluateRequirement(requirement, facts);

    expect(result.status).toBe('MET');
  });

  it('evaluates combat level requirements', () => {
    const requirement: Requirement = {
      type: 'combat-level',
      level: 60,
    };
    const result = evaluateRequirement(requirement, facts);

    expect(result.status).toBe('MET');
  });

  it('marks manual checks as unknown', () => {
    const requirement: Requirement = {
      type: 'manual-check',
      label: 'Requires a custom unlock',
    };
    const result = evaluateRequirement(requirement, facts);

    expect(result.status).toBe('UNKNOWN');
  });

  it('evaluates all-of requirements', () => {
    const requirement: Requirement = {
      type: 'all-of',
      requirements: [
        { type: 'quest-complete', questId: 'cooks_assistant' },
        { type: 'quest-complete', questId: 'dragon_slayer' },
      ],
    };
    const result = evaluateRequirement(requirement, facts);

    expect(result.status).toBe('NOT_MET');
    expect(result.children).toHaveLength(2);
  });

  it('evaluates any-of requirements', () => {
    const requirement: Requirement = {
      type: 'any-of',
      requirements: [
        { type: 'quest-complete', questId: 'dragon_slayer' },
        { type: 'quest-complete', questId: 'cooks_assistant' },
      ],
    };
    const result = evaluateRequirement(requirement, facts);

    expect(result.status).toBe('MET');
  });
});

describe('summarize helpers', () => {
  it('summarizes statuses correctly', () => {
    expect(summarizeStatuses(['MET', 'MET'])).toBe('MET');
    expect(summarizeStatuses(['MET', 'UNKNOWN'])).toBe('UNKNOWN');
    expect(summarizeStatuses(['NOT_MET', 'MET'])).toBe('NOT_MET');
  });

  it('summarizes any-of statuses correctly', () => {
    expect(summarizeAnyStatuses(['NOT_MET', 'NOT_MET'])).toBe('NOT_MET');
    expect(summarizeAnyStatuses(['UNKNOWN', 'NOT_MET'])).toBe('UNKNOWN');
    expect(summarizeAnyStatuses(['MET', 'UNKNOWN'])).toBe('MET');
  });
});

describe('evaluateRequirementSet', () => {
  it('returns overall status from required requirements', () => {
    const required: Requirement[] = [
      { type: 'quest-complete', questId: 'cooks_assistant' },
      { type: 'quest-complete', questId: 'dragon_slayer' },
    ];
    const optional: Requirement[] = [{ type: 'item-possessed', itemId: 4151 }];

    const result = evaluateRequirementSet(required, optional, facts);

    expect(result.status).toBe('NOT_MET');
    expect(result.optional).toHaveLength(1);
  });
});

describe('getSkillShortfall', () => {
  it('returns null when skill is unknown', () => {
    const missingFacts: CharacterFacts = {
      ...facts,
      skillLevels: {
        attack: { name: 'attack', level: 70, xp: 737627 },
      },
    };
    const result = getSkillShortfall('defence', 20, missingFacts);
    expect(result).toBeNull();
  });

  it('returns zero shortfall when skill meets requirement', () => {
    const result = getSkillShortfall('attack', 50, facts);
    expect(result?.levelsNeeded).toBe(0);
  });

  it('returns positive shortfall when skill is below requirement', () => {
    const result = getSkillShortfall('magic', 65, facts);
    expect(result?.levelsNeeded).toBe(5);
  });
});
