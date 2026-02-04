import { MemoryCache, type CacheAdapter } from '@skillbound/cache';
import pRetry from 'p-retry';

import { parseHiscoresJson } from './parser';
import type { GameMode, HiscoresResponse } from './types';
import {
  HiscoresNotFoundError,
  HiscoresRateLimitError,
  HiscoresServerError,
} from './types';

/**
 * Hiscores client configuration
 */
export interface HiscoresClientConfig {
  baseUrl?: string;
  retries?: number;
  retryDelay?: number;
  timeoutMs?: number;
  cache?: CacheAdapter<HiscoresResponse> | null;
  cacheTtlMs?: number;
  userAgent?: string;
}

/**
 * Game mode to hiscores table mapping
 */
const MODE_TABLE_MAP: Record<GameMode, string> = {
  normal: 'hiscore_oldschool',
  ironman: 'hiscore_oldschool_ironman',
  'hardcore-ironman': 'hiscore_oldschool_hardcore_ironman',
  'ultimate-ironman': 'hiscore_oldschool_ultimate',
};

/**
 * OSRS Hiscores API client with retries and error handling
 */
export class HiscoresClient {
  private readonly baseUrl: string;
  private readonly retries: number;
  private readonly retryDelay: number;
  private readonly timeoutMs: number;
  private readonly cache: CacheAdapter<HiscoresResponse> | null;
  private readonly cacheTtlMs: number;
  private readonly userAgent: string;

  constructor(config: HiscoresClientConfig = {}) {
    this.baseUrl = config.baseUrl ?? 'https://secure.runescape.com';
    this.retries = config.retries ?? 3;
    this.retryDelay = config.retryDelay ?? 1000;
    this.timeoutMs = config.timeoutMs ?? 10000;
    this.cache = config.cache ?? new MemoryCache<HiscoresResponse>();
    this.cacheTtlMs = config.cacheTtlMs ?? 10 * 60 * 1000;
    this.userAgent =
      config.userAgent ??
      'Skillbound (https://skillbound.app; contact: dev@skillbound.app)';
  }

  /**
   * Fetch hiscores data for a character
   */
  async lookup(username: string, mode: GameMode): Promise<HiscoresResponse> {
    const table = MODE_TABLE_MAP[mode];
    const url = `${this.baseUrl}/m=${table}/index_lite.json?player=${encodeURIComponent(username)}`;
    const cacheKey = `hiscores:${table}:${username.toLowerCase()}`;

    if (this.cache) {
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const result = await pRetry(
      async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

        try {
          const response = await fetch(url, {
            signal: controller.signal,
            redirect: 'manual',
            headers: {
              'User-Agent': this.userAgent,
              Accept: 'application/json',
            },
          });

          if (response.status === 404 || response.status === 303) {
            throw new HiscoresNotFoundError(username, mode);
          }

          if (response.status === 429) {
            throw new HiscoresRateLimitError();
          }

          if (!response.ok) {
            throw new HiscoresServerError(
              `HTTP ${response.status}: ${response.statusText}`
            );
          }

          const json = await response.json();
          return parseHiscoresJson(json, username, mode);
        } finally {
          clearTimeout(timeoutId);
        }
      },
      {
        retries: this.retries,
        minTimeout: this.retryDelay,
        maxTimeout: this.retryDelay * 3,
        onFailedAttempt: ({ error, attemptNumber }) => {
          console.warn(
            `Hiscores lookup attempt ${attemptNumber} failed:`,
            error.message
          );
        },
      }
    );

    if (this.cache) {
      await this.cache.set(cacheKey, result, this.cacheTtlMs);
    }

    return result;
  }

  /**
   * Attempt lookup across multiple modes.
   * Returns the mode with the most ranked skills to correctly identify account type.
   * This handles cases where accounts appear on multiple hiscores with different rank counts.
   */
  async lookupAuto(
    username: string,
    modes: GameMode[] = [
      'normal',
      'ironman',
      'hardcore-ironman',
      'ultimate-ironman',
    ]
  ): Promise<HiscoresResponse> {
    const results: Array<{
      mode: GameMode;
      data: HiscoresResponse;
      rankedCount: number;
    }> = [];

    for (const mode of modes) {
      try {
        const data = await this.lookup(username, mode);
        // Count how many skills have actual ranks (rank > 0)
        const rankedCount = data.skills.filter(
          (skill) => skill.rank > 0
        ).length;
        results.push({ mode, data, rankedCount });
      } catch (error) {
        if (error instanceof HiscoresNotFoundError) {
          continue;
        }
        throw error;
      }
    }

    if (results.length === 0) {
      throw new HiscoresNotFoundError(username, modes[0] ?? 'normal');
    }

    // Return the result with the most ranked skills
    // This correctly identifies ironman accounts that appear on normal hiscores with fewer ranks
    results.sort((a, b) => b.rankedCount - a.rankedCount);
    const bestMatch = results[0];
    if (!bestMatch) {
      throw new HiscoresNotFoundError(username, modes[0] ?? 'normal');
    }
    return bestMatch.data;
  }

  /**
   * Batch lookup multiple characters
   */
  async lookupBatch(
    requests: Array<{ username: string; mode: GameMode }>
  ): Promise<HiscoresResponse[]> {
    // Add delay between requests to avoid rate limiting
    const results: HiscoresResponse[] = [];

    for (const { username, mode } of requests) {
      try {
        const result = await this.lookup(username, mode);
        results.push(result);

        // Wait 100ms between requests
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        // Log but continue with other requests
        console.error(`Failed to lookup ${username}:`, error);
      }
    }

    return results;
  }
}

/**
 * Create a hiscores client with default configuration
 */
export function createHiscoresClient(
  config?: HiscoresClientConfig
): HiscoresClient {
  return new HiscoresClient(config);
}
