import pRetry from 'p-retry';
import { z } from 'zod';

import { buildCacheKey } from '../shared/cache';
import { HttpError, ParseError } from '../shared/errors';
import { fetchJson } from '../shared/http';

import {
  templeEnvelopeSchema,
  templePlayerDatapointsSchema,
  templePlayerGainsSchema,
  templePlayerInfoSchema,
  templePlayerStatsSchema,
} from './schema';
import type {
  TempleClient,
  TempleClientConfig,
  TempleGainsPeriod,
  TemplePlayerDatapoints,
  TemplePlayerGains,
  TemplePlayerInfo,
  TemplePlayerStats,
} from './types';

export class TempleNotFoundError extends Error {
  readonly username: string;

  constructor(username: string) {
    super(`TempleOSRS player not found: ${username}`);
    this.name = 'TempleNotFoundError';
    this.username = username;
  }
}

export class TempleRateLimitError extends Error {
  constructor() {
    super('TempleOSRS rate limit exceeded');
    this.name = 'TempleRateLimitError';
  }
}

export class TempleServerError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'TempleServerError';
    this.status = status;
  }
}

const DEFAULT_BASE_URL = 'https://templeosrs.com/api';

function buildEndpointUrl(baseUrl: string, endpoint: string) {
  return `${baseUrl}/${endpoint}.php`;
}

function getCacheKey(prefix: string, username: string, extra?: string): string {
  return buildCacheKey(['temple', prefix, username.toLowerCase(), extra]);
}

function extractTempleData<T>(payload: unknown, schema: z.ZodType<T>): T {
  const envelope = templeEnvelopeSchema.safeParse(payload);
  if (envelope.success) {
    const status = envelope.data.status?.toLowerCase();
    if (status && status !== 'success') {
      throw new TempleServerError(
        400,
        envelope.data.message ?? envelope.data.error ?? 'TempleOSRS error'
      );
    }
    if (envelope.data.error) {
      throw new TempleServerError(400, envelope.data.error);
    }
    if (envelope.data.data !== undefined) {
      return schema.parse(envelope.data.data);
    }
  }

  return schema.parse(payload);
}

async function requestTemple<T>(options: {
  endpoint: string;
  query: Record<string, string | number | undefined>;
  timeoutMs: number;
  baseUrl: string;
  userAgent?: string;
  schema: z.ZodType<T>;
}): Promise<T> {
  return pRetry(
    async () => {
      try {
        const headers = options.userAgent
          ? { 'user-agent': options.userAgent }
          : undefined;
        const data = await fetchJson({
          url: buildEndpointUrl(options.baseUrl, options.endpoint),
          timeoutMs: options.timeoutMs,
          query: options.query,
          ...(headers ? { headers } : {}),
        });

        return extractTempleData(data, options.schema);
      } catch (error) {
        if (error instanceof HttpError) {
          if (error.status === 404) {
            throw new TempleNotFoundError(
              String(options.query['player'] ?? 'unknown')
            );
          }
          if (error.status === 429) {
            throw new TempleRateLimitError();
          }
          throw new TempleServerError(error.status, error.message);
        }

        if (error instanceof z.ZodError) {
          throw new ParseError(
            'TempleOSRS response validation failed',
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
        if (error instanceof TempleNotFoundError) {
          return false;
        }
        if (error instanceof TempleRateLimitError) {
          return true;
        }
        if (error instanceof TempleServerError) {
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

export function createTempleClient(
  config: TempleClientConfig = {}
): TempleClient {
  const baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
  const timeoutMs = config.timeoutMs ?? 10_000;
  const cache = config.cache ?? null;
  const cacheTtlMs = config.cacheTtlMs ?? 5 * 60 * 1000;
  const userAgent = config.userAgent;

  async function getCached<T>(key: string): Promise<T | null> {
    if (!cache) {
      return null;
    }
    const cached = await cache.get(key);
    return (cached as T | null) ?? null;
  }

  async function setCached<T>(key: string, value: T) {
    if (cache) {
      await cache.set(key, value, cacheTtlMs);
    }
  }

  async function getPlayerInfo(username: string): Promise<TemplePlayerInfo> {
    const cacheKey = getCacheKey('player_info', username);
    const cached = await getCached<TemplePlayerInfo>(cacheKey);
    if (cached) {
      return cached;
    }

    const data = await requestTemple({
      endpoint: 'player_info',
      query: { player: username },
      timeoutMs,
      baseUrl,
      schema: templePlayerInfoSchema,
      ...(userAgent ? { userAgent } : {}),
    });

    await setCached(cacheKey, data);
    return data;
  }

  async function getPlayerStats(username: string): Promise<TemplePlayerStats> {
    const cacheKey = getCacheKey('player_stats', username);
    const cached = await getCached<TemplePlayerStats>(cacheKey);
    if (cached) {
      return cached;
    }

    const data = await requestTemple({
      endpoint: 'player_stats',
      query: { player: username },
      timeoutMs,
      baseUrl,
      schema: templePlayerStatsSchema,
      ...(userAgent ? { userAgent } : {}),
    });

    await setCached(cacheKey, data);
    return data;
  }

  async function getPlayerGains(
    username: string,
    period: TempleGainsPeriod = 'week'
  ) {
    const cacheKey = getCacheKey('player_gains', username, period);
    const cached = await getCached<TemplePlayerGains>(cacheKey);
    if (cached) {
      return cached;
    }

    const data = await requestTemple({
      endpoint: 'player_gains',
      query: { player: username, period },
      timeoutMs,
      baseUrl,
      schema: templePlayerGainsSchema,
      ...(userAgent ? { userAgent } : {}),
    });

    await setCached(cacheKey, data);
    return data;
  }

  async function getPlayerDatapoints(username: string, interval = 'week') {
    const cacheKey = getCacheKey('player_datapoints', username, interval);
    const cached = await getCached<TemplePlayerDatapoints>(cacheKey);
    if (cached) {
      return cached;
    }

    const data = await requestTemple({
      endpoint: 'player_datapoints',
      query: { player: username, interval },
      timeoutMs,
      baseUrl,
      schema: templePlayerDatapointsSchema,
      ...(userAgent ? { userAgent } : {}),
    });

    await setCached(cacheKey, data);
    return data;
  }

  return {
    getPlayerInfo,
    getPlayerStats,
    getPlayerGains,
    getPlayerDatapoints,
  };
}

export type {
  TempleClient,
  TempleClientConfig,
  TempleGainsPeriod,
  TemplePlayerDatapoints,
  TemplePlayerGains,
  TemplePlayerInfo,
  TemplePlayerStats,
} from './types';
