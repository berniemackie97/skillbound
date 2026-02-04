export interface CacheAdapter<T = unknown> {
  get(key: string): Promise<T | null>;
  set(key: string, value: T, ttlMs: number): Promise<void>;
}

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

export class MemoryCache<T> implements CacheAdapter<T> {
  private store = new Map<string, CacheEntry<T>>();

  get(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) {
      return Promise.resolve(null);
    }

    if (Date.now() >= entry.expiresAt) {
      this.store.delete(key);
      return Promise.resolve(null);
    }

    return Promise.resolve(entry.value);
  }

  set(key: string, value: T, ttlMs: number): Promise<void> {
    const ttl = Number.isFinite(ttlMs) ? ttlMs : 0;
    const expiresAt = Date.now() + Math.max(0, ttl);
    this.store.set(key, { value, expiresAt });
    return Promise.resolve();
  }
}

export function buildCacheKey(
  parts: Array<string | number | undefined>
): string {
  return parts.filter((part) => part !== undefined).join(':');
}
