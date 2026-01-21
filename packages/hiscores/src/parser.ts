import type {
  GameMode,
  HiscoresResponse,
  RawActivityData,
  RawSkillData,
} from './types';

/**
 * Skill names in the order they appear in the CSV
 */
const SKILL_NAMES = [
  'overall',
  'attack',
  'defence',
  'strength',
  'hitpoints',
  'ranged',
  'prayer',
  'magic',
  'cooking',
  'woodcutting',
  'fletching',
  'fishing',
  'firemaking',
  'crafting',
  'smithing',
  'mining',
  'herblore',
  'agility',
  'thieving',
  'slayer',
  'farming',
  'runecraft',
  'hunter',
  'construction',
] as const;

/**
 * Parse CSV line into skill data
 */
function parseSkillLine(line: string): RawSkillData {
  const [rankStr, levelStr, xpStr] = line.split(',');

  if (!rankStr || !levelStr || !xpStr) {
    throw new Error(`Invalid skill line: ${line}`);
  }

  return {
    rank: rankStr === '-1' ? -1 : parseInt(rankStr, 10),
    level: parseInt(levelStr, 10),
    xp: parseInt(xpStr, 10),
  };
}

/**
 * Parse CSV line into activity data
 */
function parseActivityLine(line: string): RawActivityData {
  const [rankStr, scoreStr] = line.split(',');

  if (!rankStr || !scoreStr) {
    throw new Error(`Invalid activity line: ${line}`);
  }

  return {
    rank: rankStr === '-1' ? -1 : parseInt(rankStr, 10),
    score: parseInt(scoreStr, 10),
  };
}

/**
 * Parse raw CSV from OSRS hiscores into structured data
 */
export function parseHiscoresCsv(
  csv: string,
  username: string,
  mode: GameMode
): HiscoresResponse {
  const lines = csv.trim().split('\n');

  if (lines.length < SKILL_NAMES.length) {
    throw new Error('Invalid hiscores CSV: insufficient lines');
  }

  const skills: Record<string, RawSkillData> = {};
  const activities: Record<string, RawActivityData> = {};

  // Parse skills (first 24 lines)
  for (let i = 0; i < SKILL_NAMES.length; i++) {
    const skillName = SKILL_NAMES[i];
    const line = lines[i];
    if (!skillName || !line) {
      throw new Error(`Missing skill at index ${i}`);
    }
    skills[skillName] = parseSkillLine(line);
  }

  // Parse activities/bosses (remaining lines)
  // We'll skip naming them for now since they vary and require a lookup
  for (let i = SKILL_NAMES.length; i < lines.length; i++) {
    const activityName = `activity_${i - SKILL_NAMES.length}`;
    const line = lines[i];
    if (!line) {
      continue;
    }
    activities[activityName] = parseActivityLine(line);
  }

  return {
    username,
    mode,
    capturedAt: new Date(),
    skills,
    activities,
  };
}
