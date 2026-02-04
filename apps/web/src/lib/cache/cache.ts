import { MemoryCache, type CacheAdapter } from '@skillbound/cache';
import type { HiscoresResponse } from '@skillbound/hiscores';

import { getRedisClient } from './redis';

const memoryCache = new MemoryCache<HiscoresResponse>();

export function getHiscoresCache(): CacheAdapter<HiscoresResponse> | null {
  const redis = getRedisClient();

  if (!redis) {
    return memoryCache;
  }

  return {
    async get(key: string) {
      const value = await redis.get<HiscoresResponse>(key);
      return value ?? null;
    },
    async set(key: string, value: HiscoresResponse, ttlMs: number) {
      await redis.set(key, value, { px: ttlMs });
    },
  };
}

export function getHiscoresCacheTtlMs(): number {
  const raw = process.env['HISCORES_CACHE_TTL_MS'];
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : 10 * 60 * 1000;
}
