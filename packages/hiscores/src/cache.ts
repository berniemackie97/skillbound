import type { GameMode, HiscoresResponse } from './types';

/**
 * Cache entry with TTL
 */
interface CacheEntry {
  data: HiscoresResponse;
  expiresAt: number;
}

/**
 * Simple in-memory cache for hiscores data
 */
export class HiscoresCache {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly ttl: number;

  constructor(ttlMs: number = 5 * 60 * 1000) {
    // Default 5 minutes
    this.ttl = ttlMs;
  }

  /**
   * Generate cache key
   */
  private getCacheKey(username: string, mode: GameMode): string {
    return `${username.toLowerCase()}:${mode}`;
  }

  /**
   * Get cached data if not expired
   */
  get(username: string, mode: GameMode): HiscoresResponse | null {
    const key = this.getCacheKey(username, mode);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Store data in cache
   */
  set(data: HiscoresResponse): void {
    const key = this.getCacheKey(data.username, data.mode);
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + this.ttl,
    });
  }

  /**
   * Clear expired entries
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  get size(): number {
    return this.cache.size;
  }
}
