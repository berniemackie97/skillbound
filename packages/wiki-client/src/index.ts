/**
 * OSRS Wiki Client
 *
 * Fetches structured data from the Old School RuneScape Wiki
 * Uses MediaWiki API with proper rate limiting and caching
 *
 * Data Sources:
 * - Combat Achievements: https://oldschool.runescape.wiki/w/Combat_Achievements/All_tasks
 * - Quest Requirements: https://oldschool.runescape.wiki/w/Quests
 * - Achievement Diaries: https://oldschool.runescape.wiki/w/Achievement_Diary
 */

export * from './client';
export * from './types';
export * from './parsers/combat-achievements';
export * from './parsers/quests';
export * from './parsers/diaries';
