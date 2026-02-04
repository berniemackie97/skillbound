/**
 * All OSRS skills in their canonical order (as they appear on hiscores)
 * Includes Sailing as listed on the official hiscores.
 */
export const SKILLS = [
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
  'sailing',
] as const;

/**
 * Union type of all skill names
 */
export type SkillName = (typeof SKILLS)[number];

/**
 * Combat skills that contribute to combat level
 */
export const COMBAT_SKILLS: readonly SkillName[] = [
  'attack',
  'strength',
  'defence',
  'hitpoints',
  'prayer',
  'ranged',
  'magic',
] as const;

/**
 * Gathering skills
 */
export const GATHERING_SKILLS: readonly SkillName[] = [
  'mining',
  'fishing',
  'woodcutting',
  'farming',
  'hunter',
  'sailing',
] as const;

/**
 * Artisan skills (production/crafting)
 */
export const ARTISAN_SKILLS: readonly SkillName[] = [
  'smithing',
  'crafting',
  'fletching',
  'cooking',
  'firemaking',
  'herblore',
  'construction',
  'runecraft',
] as const;

/**
 * Support skills
 */
export const SUPPORT_SKILLS: readonly SkillName[] = [
  'agility',
  'thieving',
  'slayer',
] as const;

/**
 * Display names for skills (proper capitalization)
 */
export const SKILL_DISPLAY_NAMES: Record<SkillName, string> = {
  attack: 'Attack',
  defence: 'Defence',
  strength: 'Strength',
  hitpoints: 'Hitpoints',
  ranged: 'Ranged',
  prayer: 'Prayer',
  magic: 'Magic',
  cooking: 'Cooking',
  woodcutting: 'Woodcutting',
  fletching: 'Fletching',
  fishing: 'Fishing',
  firemaking: 'Firemaking',
  crafting: 'Crafting',
  smithing: 'Smithing',
  mining: 'Mining',
  herblore: 'Herblore',
  agility: 'Agility',
  thieving: 'Thieving',
  slayer: 'Slayer',
  farming: 'Farming',
  runecraft: 'Runecraft',
  hunter: 'Hunter',
  construction: 'Construction',
  sailing: 'Sailing',
} as const;

/**
 * Type guard to check if a string is a valid skill name
 */
export function isSkillName(value: unknown): value is SkillName {
  return typeof value === 'string' && SKILLS.includes(value as SkillName);
}

/**
 * Get display name for a skill
 */
export function getSkillDisplayName(skill: SkillName): string {
  return SKILL_DISPLAY_NAMES[skill];
}

/**
 * Represents a skill with level and XP
 */
export interface SkillData {
  readonly name: SkillName;
  readonly level: number;
  readonly xp: number;
}

/**
 * Complete skills object for a character
 */
export type Skills = Record<SkillName, SkillData>;

/**
 * Account modes in OSRS
 */
export const ACCOUNT_MODES = [
  'normal',
  'ironman',
  'hardcore-ironman',
  'ultimate-ironman',
] as const;

export type AccountMode = (typeof ACCOUNT_MODES)[number];

/**
 * Display names for account modes
 */
export const ACCOUNT_MODE_DISPLAY_NAMES: Record<AccountMode, string> = {
  normal: 'Normal',
  ironman: 'Ironman',
  'hardcore-ironman': 'Hardcore Ironman',
  'ultimate-ironman': 'Ultimate Ironman',
} as const;

/**
 * Type guard for account mode
 */
export function isAccountMode(value: unknown): value is AccountMode {
  return (
    typeof value === 'string' && ACCOUNT_MODES.includes(value as AccountMode)
  );
}

/**
 * Hiscores endpoints for different account modes
 */
export const HISCORES_ENDPOINTS: Record<AccountMode, string> = {
  normal: 'https://secure.runescape.com/m=hiscore_oldschool/index_lite.json',
  ironman:
    'https://secure.runescape.com/m=hiscore_oldschool_ironman/index_lite.json',
  'hardcore-ironman':
    'https://secure.runescape.com/m=hiscore_oldschool_hardcore_ironman/index_lite.json',
  'ultimate-ironman':
    'https://secure.runescape.com/m=hiscore_oldschool_ultimate/index_lite.json',
} as const;

export function buildHiscoresUrl(mode: AccountMode, username: string): string {
  return `${HISCORES_ENDPOINTS[mode]}?player=${encodeURIComponent(username)}`;
}
