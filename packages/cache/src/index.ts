export interface CacheAdapter<T = unknown> {
  get(key: string): Promise<T | null>;
  set(key: string, value: T, ttlMs: number): Promise<void>;
}

type CacheEntry<T> = {
  data: T;
  expiresAt: number;
};

export class MemoryCache<T = unknown> implements CacheAdapter<T> {
  private readonly cache = new Map<string, CacheEntry<T>>();

  get(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    if (!entry) {
      return Promise.resolve(null);
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return Promise.resolve(null);
    }

    return Promise.resolve(entry.data);
  }

  set(key: string, value: T, ttlMs: number): Promise<void> {
    const ttl = Number.isFinite(ttlMs) ? ttlMs : 0;
    this.cache.set(key, {
      data: value,
      expiresAt: Date.now() + Math.max(0, ttl),
    });
    return Promise.resolve();
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}
