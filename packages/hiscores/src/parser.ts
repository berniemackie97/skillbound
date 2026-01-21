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
 * Activity/Boss names in the order they appear in the CSV (after skills)
 * Based on OSRS Hiscores API order
 */
const ACTIVITY_NAMES = [
  'league_points',
  'bounty_hunter_hunter',
  'bounty_hunter_rogue',
  'bounty_hunter_legacy_hunter',
  'bounty_hunter_legacy_rogue',
  'clue_scrolls_all',
  'clue_scrolls_beginner',
  'clue_scrolls_easy',
  'clue_scrolls_medium',
  'clue_scrolls_hard',
  'clue_scrolls_elite',
  'clue_scrolls_master',
  'lms_rank',
  'pvp_arena_rank',
  'soul_wars_zeal',
  'rifts_closed',
  'colosseum_glory',
  'abyssal_sire',
  'alchemical_hydra',
  'artio',
  'barrows_chests',
  'bryophyta',
  'callisto',
  'calvarion',
  'cerberus',
  'chambers_of_xeric',
  'chambers_of_xeric_challenge_mode',
  'chaos_elemental',
  'chaos_fanatic',
  'commander_zilyana',
  'corporeal_beast',
  'crazy_archaeologist',
  'dagannoth_prime',
  'dagannoth_rex',
  'dagannoth_supreme',
  'deranged_archaeologist',
  'duke_sucellus',
  'general_graardor',
  'giant_mole',
  'grotesque_guardians',
  'hespori',
  'kalphite_queen',
  'king_black_dragon',
  'kraken',
  'kreearra',
  'kril_tsutsaroth',
  'lunar_chests',
  'mimic',
  'nex',
  'nightmare',
  'phosanis_nightmare',
  'obor',
  'phantom_muspah',
  'sarachnis',
  'scorpia',
  'scurrius',
  'skotizo',
  'sol_heredit',
  'spindel',
  'tempoross',
  'the_gauntlet',
  'the_corrupted_gauntlet',
  'the_leviathan',
  'the_whisperer',
  'theatre_of_blood',
  'theatre_of_blood_hard_mode',
  'thermonuclear_smoke_devil',
  'tombs_of_amascut',
  'tombs_of_amascut_expert',
  'tzkal_zuk',
  'tztok_jad',
  'vardorvis',
  'venenatis',
  'vetion',
  'vorkath',
  'wintertodt',
  'zalcano',
  'zulrah',
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
  for (let i = SKILL_NAMES.length; i < lines.length; i++) {
    const activityIndex = i - SKILL_NAMES.length;
    const activityName = ACTIVITY_NAMES[activityIndex];
    const line = lines[i];

    if (!line) {
      continue;
    }

    // Use the proper activity name if we have it, otherwise fallback to index
    const key = activityName ?? `activity_${activityIndex}`;
    activities[key] = parseActivityLine(line);
  }

  return {
    username,
    mode,
    capturedAt: new Date(),
    skills,
    activities,
  };
}
