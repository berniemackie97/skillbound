// XP Table and calculations
export {
  getLevelForXp,
  getProgressToNextLevel,
  getXpBetweenLevels,
  getXpForLevel,
  getXpToNextLevel,
  MAX_LEVEL,
  MAX_LEVEL_XP,
  MAX_VIRTUAL_LEVEL,
  MAX_XP,
  XP_TABLE,
} from './data/xp-table';

// Skills and types
export {
  ACCOUNT_MODE_DISPLAY_NAMES,
  ACCOUNT_MODES,
  ARTISAN_SKILLS,
  COMBAT_SKILLS,
  GATHERING_SKILLS,
  HISCORES_ENDPOINTS,
  isAccountMode,
  isSkillName,
  SKILL_DISPLAY_NAMES,
  SKILLS,
  SUPPORT_SKILLS,
  type AccountMode,
  type SkillData,
  type SkillName,
  type Skills,
  getSkillDisplayName,
} from './types/skills';

// XP Calculator service
export {
  calculateActionsNeeded,
  calculateActionPlan,
  calculateNextMilestone,
  calculateXpFromActions,
  calculateXpToLevel,
  calculateXpToTargetXp,
  estimateTimeToComplete,
  type ActionCalculationResult,
  type ActionPlanResult,
  type ActionsNeededResult,
  type NextMilestoneResult,
  type TimeEstimationResult,
  type XpAction,
  type XpCalculationResult,
} from './services/xp-calculator';

// Requirements engine
export {
  evaluateRequirement,
  evaluateRequirements,
  evaluateRequirementSet,
  getDiaryKey,
  getDiaryTaskKey,
  getSkillShortfall,
  summarizeAnyStatuses,
  summarizeStatuses,
} from './requirements';
export type {
  AllOfRequirement,
  AnyOfRequirement,
  ActivityScoreRequirement,
  CombinedSkillLevelRequirement,
  CombatLevelRequirement,
  CharacterFacts,
  CombatAchievementRequirement,
  DiaryRequirement,
  DiaryTaskRequirement,
  ItemRequirement,
  ManualCheckRequirement,
  QuestRequirement,
  Requirement,
  RequirementResult,
  RequirementStatus,
  SkillLevelRequirement,
  SkillShortfall,
  UnlockRequirement,
} from './requirements';

// Progress utilities
export {
  calculateCombatLevel,
  calculateTotalLevel,
  calculateTotalXp,
  diffSnapshots,
} from './services/progress';
export type {
  ProgressDiff,
  ProgressSnapshot,
  SkillDelta,
  SkillSnapshot,
} from './types/progress';
