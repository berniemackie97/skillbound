import type { SkillName } from './skills';

export type SkillSnapshot = {
  name: SkillName;
  level: number;
  xp: number;
  rank: number | null;
};

export type ProgressSnapshot = {
  capturedAt: string;
  totalLevel: number;
  totalXp: number;
  combatLevel: number;
  skills: SkillSnapshot[];
  activities?: Record<string, number>;
};

export type SkillDelta = {
  levelDelta: number;
  xpDelta: number;
};

export type ProgressDiff = {
  from: string;
  to: string;
  totalLevelDelta: number;
  totalXpDelta: number;
  combatLevelDelta: number;
  skillDeltas: Record<SkillName, SkillDelta>;
  activityDeltas: Record<string, number>;
};
