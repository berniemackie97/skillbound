/**
 * Official OSRS XP table
 * Source: OSRS Wiki https://oldschool.runescape.wiki/w/Experience
 *
 * This table is immutable and canonical. Level 1 starts at index 0.
 * Maximum level is 99 (index 98), requiring 13,034,431 XP.
 * Virtual level 126 (200M XP) is at index 125.
 */
export const XP_TABLE: readonly number[] = Object.freeze([
  0, // Level 1
  83, // Level 2
  174,
  276,
  388,
  512,
  650,
  801,
  969,
  1154, // Level 10
  1358,
  1584,
  1833,
  2107,
  2411,
  2746,
  3115,
  3523,
  3973,
  4470, // Level 20
  5018,
  5624,
  6291,
  7028,
  7842,
  8740,
  9730,
  10824,
  12031,
  13363, // Level 30
  14833,
  16456,
  18247,
  20224,
  22406,
  24815,
  27473,
  30408,
  33648,
  37224, // Level 40
  41171,
  45529,
  50339,
  55649,
  61512,
  67983,
  75127,
  83014,
  91721,
  101333, // Level 50
  111945,
  123660,
  136594,
  150872,
  166636,
  184040,
  203254,
  224466,
  247886,
  273742, // Level 60
  302288,
  333804,
  368599,
  407015,
  449428,
  496254,
  547953,
  605032,
  668051,
  737627, // Level 70
  814445,
  899257,
  992895,
  1096278,
  1210421,
  1336443,
  1475581,
  1629200,
  1798808,
  1986068, // Level 80
  2192818,
  2421087,
  2673114,
  2951373,
  3258594,
  3597792,
  3972294,
  4385776,
  4842295,
  5346332, // Level 90
  5902831,
  6517253,
  7195629,
  7944614,
  8771558,
  9684577,
  10692629,
  11805606,
  13034431, // Level 99
  // Virtual levels 100-126 (not used in-game but useful for calculations)
  14391160,
  15889109,
  17542976,
  19368992,
  21385073,
  23611006,
  26068632,
  28782069,
  31777943,
  35085654, // Level 109
  38737661,
  42769801,
  47221641,
  52136869,
  57563718,
  63555443,
  70170840,
  77474828,
  85539082,
  94442737, // Level 119
  104273167,
  115126838,
  127110260,
  140341028,
  154948977,
  171077457,
  188884740, // Level 126
]);

/**
 * Maximum regular level in OSRS
 */
export const MAX_LEVEL = 99;

/**
 * Maximum virtual level (200M XP)
 */
export const MAX_VIRTUAL_LEVEL = 126;

/**
 * XP required for level 99
 */
export const MAX_LEVEL_XP = XP_TABLE[MAX_LEVEL - 1] as number;

/**
 * Maximum XP (200M)
 */
export const MAX_XP = 200_000_000;

/**
 * Get XP required for a specific level
 * @param level - Level (1-126)
 * @returns XP required to reach that level
 * @throws Error if level is out of bounds
 */
export function getXpForLevel(level: number): number {
  if (level < 1 || level > MAX_VIRTUAL_LEVEL) {
    throw new Error(
      `Level must be between 1 and ${MAX_VIRTUAL_LEVEL}, got ${level}`
    );
  }

  // Level 1 requires 0 XP
  if (level === 1) {
    return 0;
  }

  return XP_TABLE[level - 1] as number;
}

/**
 * Get level for a specific XP amount
 * @param xp - Experience points (0-200,000,000)
 * @returns Level (1-126)
 * @throws Error if XP is negative or exceeds maximum
 */
export function getLevelForXp(xp: number): number {
  if (xp < 0) {
    throw new Error(`XP cannot be negative, got ${xp}`);
  }

  if (xp > MAX_XP) {
    throw new Error(`XP cannot exceed ${MAX_XP}, got ${xp}`);
  }

  // Level 1 at 0 XP
  if (xp === 0) {
    return 1;
  }

  // Binary search for efficiency
  let left = 0;
  let right = XP_TABLE.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const midXp = XP_TABLE[mid] as number;

    if (midXp === xp) {
      // Exact level boundary
      return mid + 1;
    } else if (midXp < xp) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  // Return the level (right + 1 is the 0-indexed position)
  return right + 1;
}

/**
 * Get XP remaining to next level
 * @param currentXp - Current experience points
 * @returns XP needed to reach next level, or 0 if at max
 */
export function getXpToNextLevel(currentXp: number): number {
  const currentLevel = getLevelForXp(currentXp);

  if (currentLevel >= MAX_VIRTUAL_LEVEL) {
    return 0;
  }

  const nextLevelXp = getXpForLevel(currentLevel + 1);
  return nextLevelXp - currentXp;
}

/**
 * Get XP between two levels
 * @param fromLevel - Starting level
 * @param toLevel - Target level
 * @returns XP needed to go from fromLevel to toLevel
 */
export function getXpBetweenLevels(fromLevel: number, toLevel: number): number {
  if (fromLevel >= toLevel) {
    return 0;
  }

  const fromXp = getXpForLevel(fromLevel);
  const toXp = getXpForLevel(toLevel);

  return toXp - fromXp;
}

/**
 * Calculate progress percentage to next level
 * @param currentXp - Current experience points
 * @returns Progress as decimal (0-1), or 1 if at max level
 */
export function getProgressToNextLevel(currentXp: number): number {
  const currentLevel = getLevelForXp(currentXp);

  if (currentLevel >= MAX_VIRTUAL_LEVEL) {
    return 1;
  }

  const currentLevelXp = getXpForLevel(currentLevel);
  const nextLevelXp = getXpForLevel(currentLevel + 1);
  const xpInLevel = currentXp - currentLevelXp;
  const xpForLevel = nextLevelXp - currentLevelXp;

  return xpInLevel / xpForLevel;
}
