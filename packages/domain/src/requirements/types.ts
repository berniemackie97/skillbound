import type { SkillData, SkillName } from '../types/skills';

export type RequirementStatus = 'MET' | 'NOT_MET' | 'IN_PROGRESS' | 'UNKNOWN';

export type SkillLevelRequirement = {
  type: 'skill-level';
  skill: SkillName;
  level: number;
};

export type QuestRequirement = {
  type: 'quest-complete';
  questId: string;
};

export type DiaryRequirement = {
  type: 'diary-complete';
  diaryId: string;
  tier: string;
};

export type DiaryTaskRequirement = {
  type: 'diary-task';
  diaryId: string;
  tier: string;
  taskId: string;
};

export type UnlockRequirement = {
  type: 'unlock-flag';
  flagId: string;
};

export type ActivityScoreRequirement = {
  type: 'activity-score';
  activityKey: string;
  score: number;
};

export type CombinedSkillLevelRequirement = {
  type: 'combined-skill-level';
  skills: SkillName[];
  totalLevel: number;
};

export type CombatLevelRequirement = {
  type: 'combat-level';
  level: number;
};

export type CombatAchievementRequirement = {
  type: 'combat-achievement';
  achievementId: string;
};

export type ItemRequirement = {
  type: 'item-possessed';
  itemId: number;
};

export type ManualCheckRequirement = {
  type: 'manual-check';
  label: string;
};

export type AllOfRequirement = {
  type: 'all-of';
  requirements: Requirement[];
};

export type AnyOfRequirement = {
  type: 'any-of';
  requirements: Requirement[];
};

export type Requirement =
  | SkillLevelRequirement
  | QuestRequirement
  | DiaryRequirement
  | DiaryTaskRequirement
  | UnlockRequirement
  | ActivityScoreRequirement
  | CombinedSkillLevelRequirement
  | CombatLevelRequirement
  | CombatAchievementRequirement
  | ItemRequirement
  | ManualCheckRequirement
  | AllOfRequirement
  | AnyOfRequirement;

export type SkillShortfall = {
  currentLevel: number;
  requiredLevel: number;
  levelsNeeded: number;
};

export type RequirementResult = {
  requirement: Requirement;
  status: RequirementStatus;
  shortfall?: SkillShortfall;
  children?: RequirementResult[];
};

export type SkillLevelInput = number | SkillData;

export type CharacterFacts = {
  skillLevels?: Partial<Record<SkillName, SkillLevelInput | null>>;
  quests?: Record<string, boolean | null | undefined>;
  diaries?: Record<string, boolean | null | undefined>;
  diaryTasks?: Record<string, boolean | null | undefined>;
  unlocks?: Record<string, boolean | null | undefined>;
  combatAchievements?: Record<string, boolean | null | undefined>;
  activities?: Record<string, number | null | undefined>;
  items?: Record<number, boolean | null | undefined>;
};
