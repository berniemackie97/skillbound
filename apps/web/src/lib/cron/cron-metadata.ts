import { getRedisClient } from '../cache/redis';

const memoryStore = new Map<string, { value: string; expiresAt: number }>();

function cleanupMemory() {
  const now = Date.now();
  for (const [key, entry] of memoryStore.entries()) {
    if (entry.expiresAt <= now) {
      memoryStore.delete(key);
    }
  }
}

function getKey(key: string) {
  return `cron-meta:${key}`;
}

export async function setCronMetadata(
  key: string,
  value: unknown,
  ttlMs = 24 * 60 * 60 * 1000
) {
  const redis = getRedisClient();
  const payload = JSON.stringify(value);
  const cacheKey = getKey(key);

  if (redis) {
    await redis.set(cacheKey, payload, { px: ttlMs });
    return;
  }

  cleanupMemory();
  memoryStore.set(cacheKey, { value: payload, expiresAt: Date.now() + ttlMs });
}

export async function getCronMetadata<T>(key: string): Promise<T | null> {
  const redis = getRedisClient();
  const cacheKey = getKey(key);

  if (redis) {
    const raw = await redis.get<string>(cacheKey);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as T;
  }

  cleanupMemory();
  const entry = memoryStore.get(cacheKey);
  if (!entry) {
    return null;
  }
  return JSON.parse(entry.value) as T;
}
