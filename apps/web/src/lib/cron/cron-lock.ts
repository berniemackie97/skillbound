import { getRedisClient } from '../cache/redis';

const memoryLocks = new Map<string, number>();

function getNow() {
  return Date.now();
}

function cleanupMemoryLocks() {
  const now = getNow();
  for (const [key, expiresAt] of memoryLocks.entries()) {
    if (expiresAt <= now) {
      memoryLocks.delete(key);
    }
  }
}

export async function acquireCronLock(key: string, ttlMs: number) {
  const redis = getRedisClient();
  const lockKey = `cron-lock:${key}`;

  if (redis) {
    const result = await redis.set(lockKey, 'locked', {
      nx: true,
      px: ttlMs,
    });
    return result === 'OK';
  }

  cleanupMemoryLocks();
  if (memoryLocks.has(lockKey)) {
    return false;
  }

  memoryLocks.set(lockKey, getNow() + ttlMs);
  return true;
}

export async function releaseCronLock(key: string) {
  const redis = getRedisClient();
  const lockKey = `cron-lock:${key}`;

  if (redis) {
    await redis.del(lockKey);
    return;
  }

  memoryLocks.delete(lockKey);
}
