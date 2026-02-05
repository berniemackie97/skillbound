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

  it('returns null for missing entries', async () => {
    const cache = new MemoryCache<string>();

    await expect(cache.get('missing')).resolves.toBeNull();
    expect(cache.size).toBe(0);
  });

  it('treats non-finite or negative TTL values as immediate expiry', async () => {
    const cache = new MemoryCache<string>();

    vi.setSystemTime(0);
    await cache.set('infinite', 'value', Number.POSITIVE_INFINITY);
    await expect(cache.get('infinite')).resolves.toBe('value');

    vi.setSystemTime(1);
    await expect(cache.get('infinite')).resolves.toBeNull();

    vi.setSystemTime(10);
    await cache.set('negative', 'value', -250);
    await expect(cache.get('negative')).resolves.toBe('value');

    vi.setSystemTime(11);
    await expect(cache.get('negative')).resolves.toBeNull();
  });
});
