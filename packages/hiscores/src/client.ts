import pRetry from 'p-retry';

import { parseHiscoresCsv } from './parser';
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
  timeout?: number;
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
  private readonly timeout: number;

  constructor(config: HiscoresClientConfig = {}) {
    this.baseUrl = config.baseUrl ?? 'https://secure.runescape.com';
    this.retries = config.retries ?? 3;
    this.retryDelay = config.retryDelay ?? 1000;
    this.timeout = config.timeout ?? 10000;
  }

  /**
   * Fetch hiscores data for a character
   */
  async lookup(username: string, mode: GameMode): Promise<HiscoresResponse> {
    const table = MODE_TABLE_MAP[mode];
    const url = `${this.baseUrl}/m=${table}/index_lite.ws?player=${encodeURIComponent(username)}`;

    return pRetry(
      async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
          const response = await fetch(url, {
            signal: controller.signal,
            headers: {
              'User-Agent': 'SkillBound/1.0',
            },
          });

          clearTimeout(timeoutId);

          // Handle 404 - character not found
          if (response.status === 404) {
            throw new HiscoresNotFoundError(username, mode);
          }

          // Handle 429 - rate limit
          if (response.status === 429) {
            throw new HiscoresRateLimitError();
          }

          // Handle other server errors
          if (!response.ok) {
            throw new HiscoresServerError(
              `HTTP ${response.status}: ${response.statusText}`
            );
          }

          const csv = await response.text();
          return parseHiscoresCsv(csv, username, mode);
        } catch (error) {
          clearTimeout(timeoutId);

          // Don't retry on not found
          if (error instanceof HiscoresNotFoundError) {
            throw error;
          }

          // Retry on rate limits and server errors
          throw error;
        }
      },
      {
        retries: this.retries,
        minTimeout: this.retryDelay,
        maxTimeout: this.retryDelay * 3,
        onFailedAttempt: (error) => {
          console.warn(
            `Hiscores lookup attempt ${error.attemptNumber} failed:`,
            error.message
          );
        },
      }
    );
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
