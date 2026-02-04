import type {
  ProgressDiff,
  ProgressSnapshot,
  SkillSnapshot,
} from '../types/progress';
import { SKILLS, type SkillName } from '../types/skills';

function normalizeLevel(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 1;
  }
  return Math.max(1, Math.floor(value));
}

function normalizeXp(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.floor(value));
}

function buildSkillMap(
  skills: SkillSnapshot[]
): Record<SkillName, SkillSnapshot> {
  const map = {} as Record<SkillName, SkillSnapshot>;

  for (const skill of SKILLS) {
    map[skill] = { name: skill, level: 1, xp: 0, rank: null };
  }

  for (const skill of skills) {
    map[skill.name] = {
      ...skill,
      level: normalizeLevel(skill.level),
      xp: normalizeXp(skill.xp),
    };
  }

  return map;
}

export function calculateTotalLevel(skills: SkillSnapshot[]): number {
  const map = buildSkillMap(skills);
  return SKILLS.reduce((sum, skill) => sum + map[skill].level, 0);
}

export function calculateTotalXp(skills: SkillSnapshot[]): number {
  const map = buildSkillMap(skills);
  return SKILLS.reduce((sum, skill) => sum + map[skill].xp, 0);
}

export function calculateCombatLevel(
  skillLevels: Partial<Record<SkillName, number>>
): number {
  const attack = normalizeLevel(skillLevels.attack);
  const strength = normalizeLevel(skillLevels.strength);
  const defence = normalizeLevel(skillLevels.defence);
  const hitpoints = normalizeLevel(skillLevels.hitpoints);
  const prayer = normalizeLevel(skillLevels.prayer);
  const ranged = normalizeLevel(skillLevels.ranged);
  const magic = normalizeLevel(skillLevels.magic);

  const base = (defence + hitpoints + Math.floor(prayer / 2)) / 4;
  const melee = 0.325 * (attack + strength);
  const range = 0.325 * Math.floor(ranged * 1.5);
  const mage = 0.325 * Math.floor(magic * 1.5);

  return Math.floor(base + Math.max(melee, range, mage));
}

export function diffSnapshots(
  previous: ProgressSnapshot,
  current: ProgressSnapshot
): ProgressDiff {
  const prevMap = buildSkillMap(previous.skills);
  const nextMap = buildSkillMap(current.skills);

  const skillDeltas = {} as Record<
    SkillName,
    { levelDelta: number; xpDelta: number }
  >;

  for (const skill of SKILLS) {
    skillDeltas[skill] = {
      levelDelta: nextMap[skill].level - prevMap[skill].level,
      xpDelta: nextMap[skill].xp - prevMap[skill].xp,
    };
  }

  const activityKeys = new Set<string>([
    ...Object.keys(previous.activities ?? {}),
    ...Object.keys(current.activities ?? {}),
  ]);
  const activityDeltas: Record<string, number> = {};

  for (const key of activityKeys) {
    const prev = previous.activities?.[key] ?? 0;
    const next = current.activities?.[key] ?? 0;
    activityDeltas[key] = next - prev;
  }

  return {
    from: previous.capturedAt,
    to: current.capturedAt,
    totalLevelDelta: current.totalLevel - previous.totalLevel,
    totalXpDelta: current.totalXp - previous.totalXp,
    combatLevelDelta: current.combatLevel - previous.combatLevel,
    skillDeltas,
    activityDeltas,
  };
}
