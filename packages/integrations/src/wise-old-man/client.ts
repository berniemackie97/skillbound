import pRetry from 'p-retry';
import { z } from 'zod';

import { buildCacheKey } from '../shared/cache';
import { HttpError, ParseError } from '../shared/errors';
import { fetchJson } from '../shared/http';

import {
  wiseOldManErrorSchema,
  wiseOldManPlayerSchema,
  wiseOldManSnapshotsSchema,
} from './schema';
import type {
  WiseOldManClient,
  WiseOldManClientConfig,
  WiseOldManPlayer,
} from './types';

export class WiseOldManNotFoundError extends Error {
  readonly username: string;

  constructor(username: string) {
    super(`Wise Old Man player not found: ${username}`);
    this.name = 'WiseOldManNotFoundError';
    this.username = username;
  }
}

export class WiseOldManRateLimitError extends Error {
  constructor() {
    super('Wise Old Man rate limit exceeded');
    this.name = 'WiseOldManRateLimitError';
  }
}

export class WiseOldManServerError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'WiseOldManServerError';
    this.status = status;
  }
}

const DEFAULT_BASE_URL = 'https://api.wiseoldman.net/v2';

function buildPlayerUrl(baseUrl: string, username: string) {
  return `${baseUrl}/players/${encodeURIComponent(username)}`;
}

function buildPlayerSnapshotsUrl(
  baseUrl: string,
  username: string,
  options?: {
    period?: 'day' | 'week' | 'month' | 'year';
    startDate?: string;
    endDate?: string;
  }
) {
  const url = new URL(
    `${baseUrl}/players/${encodeURIComponent(username)}/snapshots`
  );
  if (options?.period) {
    url.searchParams.set('period', options.period);
  }
  if (options?.startDate) {
    url.searchParams.set('startDate', options.startDate);
  }
  if (options?.endDate) {
    url.searchParams.set('endDate', options.endDate);
  }
  return url.toString();
}

function getCacheKey(username: string): string {
  return buildCacheKey(['wise-old-man', username.toLowerCase()]);
}

async function requestPlayer(
  username: string,
  options: {
    baseUrl: string;
    timeoutMs: number;
    userAgent?: string;
    method: 'GET' | 'POST';
  }
): Promise<WiseOldManPlayer> {
  return pRetry(
    async () => {
      try {
        const headers = options.userAgent
          ? { 'user-agent': options.userAgent }
          : undefined;
        const data = await fetchJson({
          url: buildPlayerUrl(options.baseUrl, username),
          method: options.method,
          timeoutMs: options.timeoutMs,
          ...(headers ? { headers } : {}),
        });

        return wiseOldManPlayerSchema.parse(data);
      } catch (error) {
        if (error instanceof HttpError) {
          if (error.status === 404) {
            throw new WiseOldManNotFoundError(username);
          }
          if (error.status === 429) {
            throw new WiseOldManRateLimitError();
          }
          if (error.body) {
            try {
              const parsed = wiseOldManErrorSchema.safeParse(
                JSON.parse(error.body)
              );
              if (parsed.success && parsed.data.message) {
                throw new WiseOldManServerError(
                  error.status,
                  parsed.data.message
                );
              }
            } catch {
              // Ignore JSON parse errors; fall back to generic handling.
            }
          }
          throw new WiseOldManServerError(error.status, error.message);
        }

        if (error instanceof z.ZodError) {
          throw new ParseError(
            'Wise Old Man response validation failed',
            error.message
          );
        }

        throw error;
      }
    },
    {
      retries: 2,
      factor: 2,
      minTimeout: 400,
      maxTimeout: 2000,
      onFailedAttempt: () => {},
      shouldRetry: ({ error }) => {
        if (error instanceof WiseOldManNotFoundError) {
          return false;
        }
        if (error instanceof WiseOldManRateLimitError) {
          return true;
        }
        if (error instanceof WiseOldManServerError) {
          return error.status >= 500;
        }
        if (error instanceof ParseError) {
          return false;
        }
        return true;
      },
    }
  );
}

export function createWiseOldManClient(
  config: WiseOldManClientConfig = {}
): WiseOldManClient {
  const baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
  const timeoutMs = config.timeoutMs ?? 10_000;
  const cache = config.cache ?? null;
  const cacheTtlMs = config.cacheTtlMs ?? 5 * 60 * 1000;
  const userAgent = config.userAgent;

  async function getPlayer(username: string): Promise<WiseOldManPlayer> {
    const cacheKey = getCacheKey(username);
    const cached = cache ? await cache.get(cacheKey) : null;
    if (cached) {
      return cached;
    }

    const player = await requestPlayer(username, {
      baseUrl,
      timeoutMs,
      method: 'GET',
      ...(userAgent ? { userAgent } : {}),
    });
    if (cache) {
      await cache.set(cacheKey, player, cacheTtlMs);
    }
    return player;
  }

  async function updatePlayer(username: string): Promise<WiseOldManPlayer> {
    const player = await requestPlayer(username, {
      baseUrl,
      timeoutMs,
      method: 'POST',
      ...(userAgent ? { userAgent } : {}),
    });
    const cacheKey = getCacheKey(username);
    if (cache) {
      await cache.set(cacheKey, player, cacheTtlMs);
    }
    return player;
  }

  async function getPlayerSnapshots(
    username: string,
    options?: {
      period?: 'day' | 'week' | 'month' | 'year';
      startDate?: string;
      endDate?: string;
    }
  ) {
    const headers = userAgent ? { 'user-agent': userAgent } : undefined;
    const data = await fetchJson({
      url: buildPlayerSnapshotsUrl(baseUrl, username, options),
      method: 'GET',
      timeoutMs,
      ...(headers ? { headers } : {}),
    });

    return wiseOldManSnapshotsSchema.parse(data);
  }

  return { getPlayer, updatePlayer, getPlayerSnapshots };
}

export type { WiseOldManPlayer } from './types';
