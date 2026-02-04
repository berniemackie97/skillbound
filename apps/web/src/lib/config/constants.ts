/**
 * Application-wide constants
 * Centralizes magic strings and numbers for consistency
 */

// Cache TTLs (in milliseconds)
export const CACHE_TTL_MS = {
  HISCORES: 10 * 60 * 1000, // 10 minutes
  ITEMS: 24 * 60 * 60 * 1000, // 24 hours
  BUNDLE: 60 * 60 * 1000, // 1 hour
  INTEGRATION: 5 * 60 * 1000, // 5 minutes
} as const;

// Diary tiers
export const DIARY_TIERS = ['easy', 'medium', 'hard', 'elite'] as const;
export type DiaryTier = (typeof DIARY_TIERS)[number];

// Quest difficulties
export const QUEST_DIFFICULTIES = [
  'Novice',
  'Intermediate',
  'Experienced',
  'Master',
  'Grandmaster',
] as const;
export type QuestDifficulty = (typeof QUEST_DIFFICULTIES)[number];

// Quest lengths
export const QUEST_LENGTHS = [
  'Very Short',
  'Short',
  'Medium',
  'Long',
  'Very Long',
] as const;
export type QuestLength = (typeof QUEST_LENGTHS)[number];

// Combat Achievement tiers
export const CA_TIERS = [
  'Easy',
  'Medium',
  'Hard',
  'Elite',
  'Master',
  'Grandmaster',
] as const;
export type CATier = (typeof CA_TIERS)[number];

// Rate limit settings
export const RATE_LIMITS = {
  HISCORES: {
    maxRequests: 60,
    windowMs: 60 * 1000, // 1 minute
  },
  API: {
    maxRequests: 100,
    windowMs: 60 * 1000, // 1 minute
  },
} as const;
