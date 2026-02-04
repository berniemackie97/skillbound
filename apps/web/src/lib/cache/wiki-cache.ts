import { MemoryCache, type CacheAdapter } from '@skillbound/cache';

import { getRedisClient } from './redis';

const memoryCache = new MemoryCache<unknown>();

function readNumberEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  const parsed = raw ? Number(raw) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getWikiCache(): CacheAdapter<unknown> | null {
  const redis = getRedisClient();

  if (!redis) {
    return memoryCache;
  }

  return {
    async get(key: string) {
      const value = await redis.get<unknown>(key);
      return value ?? null;
    },
    async set(key: string, value: unknown, ttlMs: number) {
      await redis.set(key, value, { px: ttlMs });
    },
  };
}

export function getWikiCacheTtlMs(
  kind: 'latest' | 'interval' | 'mapping' | 'timeseries'
): number {
  switch (kind) {
    case 'latest':
      return readNumberEnv('WIKI_PRICES_CACHE_TTL_MS', 10 * 60 * 1000);
    case 'interval':
      return readNumberEnv('WIKI_PRICES_INTERVAL_CACHE_TTL_MS', 5 * 60 * 1000);
    case 'mapping':
      return readNumberEnv(
        'WIKI_PRICES_MAPPING_CACHE_TTL_MS',
        24 * 60 * 60 * 1000
      );
    case 'timeseries':
      return readNumberEnv(
        'WIKI_PRICES_TIMESERIES_CACHE_TTL_MS',
        10 * 60 * 1000
      );
  }
}
