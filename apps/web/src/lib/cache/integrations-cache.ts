import { MemoryCache, type CacheAdapter } from '@skillbound/integrations';

import { getRedisClient } from './redis';

const memoryCache = new MemoryCache<unknown>();

function readNumberEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  const parsed = raw ? Number(raw) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getIntegrationsCache<T = unknown>(): CacheAdapter<T> | null {
  const redis = getRedisClient();

  if (!redis) {
    return memoryCache as unknown as CacheAdapter<T>;
  }

  return {
    async get(key: string) {
      const value = await redis.get<T>(key);
      return value ?? null;
    },
    async set(key: string, value: T, ttlMs: number) {
      await redis.set(key, value, { px: ttlMs });
    },
  };
}

export function getIntegrationsCacheTtlMs(
  source: 'wise-old-man' | 'temple' | 'osrsbox' | 'collectionlog'
): number {
  switch (source) {
    case 'wise-old-man':
      return readNumberEnv('WISE_OLD_MAN_CACHE_TTL_MS', 5 * 60 * 1000);
    case 'temple':
      return readNumberEnv('TEMPLE_CACHE_TTL_MS', 5 * 60 * 1000);
    case 'osrsbox':
      return readNumberEnv('OSRSBOX_CACHE_TTL_MS', 24 * 60 * 60 * 1000);
    case 'collectionlog':
      return readNumberEnv('COLLECTIONLOG_CACHE_TTL_MS', 10 * 60 * 1000);
  }
}
