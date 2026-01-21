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
 * Raw skill data from hiscores CSV
 */
export interface RawSkillData {
  rank: number;
  level: number;
  xp: number;
}

/**
 * Raw activity/boss data from hiscores CSV
 */
export interface RawActivityData {
  rank: number;
  score: number;
}

/**
 * Complete hiscores response
 */
export interface HiscoresResponse {
  username: string;
  mode: GameMode;
  capturedAt: Date;
  skills: Record<string, RawSkillData>;
  activities: Record<string, RawActivityData>;
}

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
