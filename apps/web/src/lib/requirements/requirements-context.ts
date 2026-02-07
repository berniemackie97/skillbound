import type { CharacterOverride } from '@skillbound/database';
import {
  isSkillName,
  type CharacterFacts,
  type SkillName,
  type SkillSnapshot,
} from '@skillbound/domain';
import type { HiscoresResponse } from '@skillbound/hiscores';

import { normalizeActivityScore } from '../character/normalize-activity-score';

function normalizeLevel(level: number): number {
  if (!Number.isFinite(level)) {
    return 1;
  }
  return Math.max(1, Math.floor(level));
}

function normalizeXp(xp: number): number {
  if (!Number.isFinite(xp)) {
    return 0;
  }
  return Math.max(0, Math.floor(xp));
}

function parseOverrideBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value;
  }
  return null;
}

export type CharacterStateEntry = {
  domain: string;
  key: string;
  value: unknown;
};

export function applyCharacterState(
  facts: CharacterFacts,
  stateData: CharacterStateEntry[]
): CharacterFacts {
  for (const state of stateData) {
    const value = state.value as Record<string, unknown>;

    switch (state.domain) {
      case 'quest': {
        facts.quests ??= {};
        const completed = value['completed'] === true;
        facts.quests[state.key] = completed;
        break;
      }
      case 'diary': {
        facts.diaries ??= {};
        const completed = value['completed'] === true;
        facts.diaries[state.key] = completed;
        break;
      }
      case 'diary_task': {
        facts.diaryTasks ??= {};
        const completed = value['completed'] === true;
        facts.diaryTasks[state.key] = completed;
        break;
      }
      case 'combat_achievement': {
        facts.combatAchievements ??= {};
        const completed = value['completed'] === true;
        facts.combatAchievements[state.key] = completed;
        break;
      }
      case 'unlock_flag': {
        facts.unlocks ??= {};
        const unlocked = value['unlocked'] === true;
        facts.unlocks[state.key] = unlocked;
        break;
      }
      default:
        break;
    }
  }

  return facts;
}

export function applyOverrides(
  overrides: CharacterOverride[],
  facts: CharacterFacts
): CharacterFacts {
  for (const override of overrides) {
    const value = parseOverrideBoolean(override.value);
    if (value === null) {
      continue;
    }

    switch (override.type) {
      case 'quest_complete':
        facts.quests ??= {};
        facts.quests[override.key] = value;
        break;
      case 'diary_complete':
        facts.diaries ??= {};
        facts.diaries[override.key] = value;
        break;
      case 'diary_task_complete':
        facts.diaryTasks ??= {};
        facts.diaryTasks[override.key] = value;
        break;
      case 'unlock_flag':
        facts.unlocks ??= {};
        facts.unlocks[override.key] = value;
        break;
      case 'item_possessed': {
        const itemId = Number(override.key);
        if (Number.isFinite(itemId)) {
          facts.items ??= {};
          facts.items[itemId] = value;
        }
        break;
      }
      case 'combat_achievement':
        facts.combatAchievements ??= {};
        facts.combatAchievements[override.key] = value;
        break;
      default:
        break;
    }
  }

  return facts;
}

export function buildCharacterFacts(
  hiscores: HiscoresResponse,
  overrides?: CharacterOverride[]
): CharacterFacts {
  const skillLevels: Partial<Record<SkillName, number>> = {};

  for (const skill of hiscores.skills) {
    if (!isSkillName(skill.key)) {
      continue;
    }

    skillLevels[skill.key] = normalizeLevel(skill.level);
  }

  const activities: Record<string, number> = {};

  for (const activity of hiscores.activities ?? []) {
    const normalizedScore = normalizeActivityScore(
      activity.key,
      activity.score
    );
    activities[activity.key] = normalizeXp(normalizedScore);
  }

  const facts: CharacterFacts = { skillLevels };
  if (Object.keys(activities).length > 0) {
    facts.activities = activities;
  }

  // Only apply overrides if provided (for backwards compatibility)
  if (overrides && overrides.length > 0) {
    return applyOverrides(overrides, facts);
  }

  return facts;
}

export function buildCharacterFactsFromSnapshot(
  skills: SkillSnapshot[],
  overrides: CharacterOverride[],
  activities?: Record<string, number> | null
): CharacterFacts {
  const skillLevels: Partial<Record<SkillName, number>> = {};

  for (const skill of skills) {
    if (!isSkillName(skill.name)) {
      continue;
    }

    skillLevels[skill.name] = normalizeLevel(skill.level);
  }

  const facts: CharacterFacts = { skillLevels };
  if (activities && Object.keys(activities).length > 0) {
    facts.activities = activities;
  }

  return applyOverrides(overrides, facts);
}

export function buildSnapshotSkills(
  hiscores: HiscoresResponse
): SkillSnapshot[] {
  const skills = hiscores.skills
    .filter((skill) => isSkillName(skill.key))
    .map((skill) => ({
      name: skill.key as SkillName,
      level: normalizeLevel(skill.level),
      xp: normalizeXp(skill.xp),
      rank: skill.rank < 0 ? null : skill.rank,
    }));

  return skills;
}

export function buildSnapshotActivities(
  hiscores: HiscoresResponse
): Record<string, number> {
  const activities: Record<string, number> = {};

  for (const activity of hiscores.activities ?? []) {
    const normalizedScore = normalizeActivityScore(
      activity.key,
      activity.score
    );
    activities[activity.key] = normalizeXp(normalizedScore);
  }

  return activities;
}
