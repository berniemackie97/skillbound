import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MemoryCache } from './index';

describe('MemoryCache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stores and expires entries', async () => {
    const cache = new MemoryCache<string>();

    await cache.set('key', 'value', 1000);
    await expect(cache.get('key')).resolves.toBe('value');
    expect(cache.size).toBe(1);

    cache.cleanup();
    expect(cache.size).toBe(1);

    vi.advanceTimersByTime(1001);
    await expect(cache.get('key')).resolves.toBeNull();
    cache.cleanup();
    expect(cache.size).toBe(0);

    await cache.set('another', 'value', 1000);
    expect(cache.size).toBe(1);
    cache.clear();
    expect(cache.size).toBe(0);
  });
});
