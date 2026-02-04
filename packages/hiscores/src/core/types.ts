import type { SkillName } from '@skillbound/domain';
import { z } from 'zod';

/**
 * OSRS hiscores game modes
 */
export const GameMode = z.enum([
  'normal',
  'ironman',
  'hardcore-ironman',
  'ultimate-ironman',
]);

export type GameMode = z.infer<typeof GameMode>;

/**
 * Normalized skill entry from hiscores JSON
 */
export interface HiscoresSkillEntry {
  id: number;
  name: string;
  key: string;
  isKnownSkill: boolean;
  rank: number;
  level: number;
  xp: number;
}

/**
 * Normalized activity/boss entry from hiscores JSON
 */
export interface HiscoresActivityEntry {
  id: number;
  name: string;
  key: string;
  rank: number;
  score: number;
}

/**
 * Complete hiscores response (JSON-based)
 */
export interface HiscoresResponse {
  username: string;
  displayName: string;
  mode: GameMode;
  capturedAt: string;
  skills: HiscoresSkillEntry[];
  activities: HiscoresActivityEntry[];
}

export type KnownSkillKey = SkillName | 'overall';

/**
 * Hiscores API error types
 */
export class HiscoresNotFoundError extends Error {
  constructor(username: string, mode: GameMode) {
    super(`Character not found: ${username} (${mode})`);
    this.name = 'HiscoresNotFoundError';
  }
}

export class HiscoresRateLimitError extends Error {
  constructor() {
    super('Hiscores API rate limit exceeded');
    this.name = 'HiscoresRateLimitError';
  }
}

export class HiscoresServerError extends Error {
  constructor(message: string) {
    super(`Hiscores server error: ${message}`);
    this.name = 'HiscoresServerError';
  }
}
