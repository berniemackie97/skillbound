import { SKILLS } from '@skillbound/domain';
import { z } from 'zod';

import type {
  GameMode,
  HiscoresActivityEntry,
  HiscoresResponse,
  HiscoresSkillEntry,
  KnownSkillKey,
} from './types';

const HiscoresSkillSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  rank: z.number().int(),
  level: z.number().int(),
  xp: z.number().int(),
});

const HiscoresActivitySchema = z.object({
  id: z.number().int(),
  name: z.string(),
  rank: z.number().int(),
  score: z.number().int(),
});

const HiscoresJsonSchema = z.object({
  name: z.string(),
  skills: z.array(HiscoresSkillSchema),
  activities: z.array(HiscoresActivitySchema).optional().default([]),
});

const SKILL_NAMES = ['overall', ...SKILLS] as const;

const KNOWN_SKILL_KEYS = new Set<string>(SKILL_NAMES);

function slugifyKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function isKnownSkillKey(key: string): key is KnownSkillKey {
  return KNOWN_SKILL_KEYS.has(key);
}

/**
 * Parse CSV line into skill data
 */
function parseSkillLine(line: string): {
  rank: number;
  level: number;
  xp: number;
} | null {
  const [rankStr, levelStr, xpStr] = line.split(',');

  if (!rankStr || !levelStr || !xpStr) {
    return null;
  }

  const rank = rankStr === '-1' ? -1 : Number.parseInt(rankStr, 10);
  const level = Number.parseInt(levelStr, 10);
  const xp = Number.parseInt(xpStr, 10);

  if (
    !Number.isFinite(rank) ||
    !Number.isFinite(level) ||
    !Number.isFinite(xp)
  ) {
    return null;
  }

  return { rank, level, xp };
}

/**
 * Parse CSV line into activity data
 */
function parseActivityLine(line: string): {
  rank: number;
  score: number;
} | null {
  const [rankStr, scoreStr] = line.split(',');

  if (!rankStr || !scoreStr) {
    return null;
  }

  const rank = rankStr === '-1' ? -1 : Number.parseInt(rankStr, 10);
  const score = Number.parseInt(scoreStr, 10);

  if (!Number.isFinite(rank) || !Number.isFinite(score)) {
    return null;
  }

  return { rank, score };
}

/**
 * Parse raw CSV from OSRS hiscores into structured data
 */
export function parseHiscoresJson(
  json: unknown,
  lookupName: string,
  mode: GameMode
): HiscoresResponse {
  const parsed = HiscoresJsonSchema.parse(json);

  const skills: HiscoresSkillEntry[] = parsed.skills.map((skill) => {
    const key = slugifyKey(skill.name);
    return {
      ...skill,
      key,
      isKnownSkill: isKnownSkillKey(key),
    };
  });

  const activities: HiscoresActivityEntry[] = parsed.activities.map(
    (activity) => ({
      ...activity,
      key: slugifyKey(activity.name),
    })
  );

  return {
    username: lookupName,
    displayName: parsed.name,
    mode,
    capturedAt: new Date().toISOString(),
    skills,
    activities,
  };
}

/**
 * @deprecated Prefer parseHiscoresJson() which includes official names and IDs.
 */
export function parseHiscoresCsv(
  csv: string,
  lookupName: string,
  mode: GameMode
): HiscoresResponse {
  const lines = csv.trim().split('\n');

  if (lines.length < SKILL_NAMES.length) {
    throw new Error('Invalid hiscores CSV: insufficient lines');
  }

  const skills: HiscoresSkillEntry[] = [];
  const activities: HiscoresActivityEntry[] = [];

  for (let i = 0; i < SKILL_NAMES.length; i++) {
    const skillName = SKILL_NAMES[i];
    const line = lines[i];
    if (!skillName) {
      console.warn(`Missing skill name at index ${i}`);
      continue;
    }
    const parsed = line ? parseSkillLine(line) : null;
    if (!parsed) {
      console.warn(`Invalid skill line at index ${i}: ${line}`);
      continue;
    }
    const key = slugifyKey(skillName);
    skills.push({
      id: i,
      name: skillName,
      key,
      isKnownSkill: isKnownSkillKey(key),
      rank: parsed.rank,
      level: parsed.level,
      xp: parsed.xp,
    });
  }

  for (let i = SKILL_NAMES.length; i < lines.length; i++) {
    const activityIndex = i - SKILL_NAMES.length;
    const line = lines[i];
    const parsed = line ? parseActivityLine(line) : null;
    if (!parsed) {
      console.warn(`Invalid activity line at index ${activityIndex}: ${line}`);
      continue;
    }
    const key = `activity_${activityIndex}`;
    activities.push({
      id: activityIndex,
      name: key,
      key,
      rank: parsed.rank,
      score: parsed.score,
    });
  }

  return {
    username: lookupName,
    displayName: lookupName,
    mode,
    capturedAt: new Date().toISOString(),
    skills,
    activities,
  };
}
