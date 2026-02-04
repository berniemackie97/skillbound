import { describe, expect, it } from 'vitest';

import { buildCacheKey, MemoryCache } from './cache';

describe('MemoryCache', () => {
  it('expires entries based on ttl', async () => {
    const cache = new MemoryCache<number>();
    await cache.set('key', 42, 0);

    const value = await cache.get('key');
    expect(value).toBeNull();
  });

  it('builds cache keys without undefined parts', () => {
    const key = buildCacheKey(['a', undefined, 'b', 2]);
    expect(key).toBe('a:b:2');
  });
});
