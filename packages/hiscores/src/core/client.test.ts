import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createHiscoresClient } from '../index';

import { HiscoresClient } from './client';
import { HiscoresNotFoundError, HiscoresRateLimitError } from './types';

const createJsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const sampleJson = {
  name: 'Test Player',
  skills: [
    { id: 0, name: 'Overall', rank: 1, level: 1000, xp: 123456 },
    { id: 1, name: 'Attack', rank: 2, level: 99, xp: 200000000 },
    { id: 24, name: 'Sailing', rank: 3, level: 70, xp: 5000000 },
  ],
  activities: [{ id: 7, name: 'Clue Scrolls (all)', rank: 10, score: 42 }],
};

describe('HiscoresClient', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns parsed JSON and caches results', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(createJsonResponse(sampleJson));

    const client = new HiscoresClient({ retries: 0 });
    const first = await client.lookup('Test Player', 'normal');
    const second = await client.lookup('Test Player', 'normal');

    expect(first.displayName).toBe('Test Player');
    expect(second.displayName).toBe('Test Player');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('supports cache-disabled clients', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(createJsonResponse(sampleJson));

    const client = new HiscoresClient({ retries: 0, cache: null });
    const result = await client.lookup('Test Player', 'normal');

    expect(result.displayName).toBe('Test Player');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws not found errors for missing players', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(createJsonResponse({}, 404));

    const client = new HiscoresClient({ retries: 0 });

    await expect(client.lookup('Missing', 'normal')).rejects.toBeInstanceOf(
      HiscoresNotFoundError
    );
  });

  it('throws rate limit errors for 429 responses', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(createJsonResponse({}, 429));

    const client = new HiscoresClient({ retries: 0 });

    await expect(client.lookup('RateLimited', 'normal')).rejects.toBeInstanceOf(
      HiscoresRateLimitError
    );
  });

  it('selects mode with most ranked skills for lookupAuto', async () => {
    const fetchMock = vi.mocked(fetch);

    // Normal hiscores - player exists but with only 1 ranked skill
    const normalJson = {
      ...sampleJson,
      skills: [
        { id: 0, name: 'Overall', rank: -1, level: 1000, xp: 123456 },
        { id: 1, name: 'Attack', rank: 2, level: 99, xp: 200000000 }, // Only 1 ranked
        { id: 24, name: 'Sailing', rank: -1, level: 70, xp: 5000000 },
      ],
    };

    // Ironman hiscores - player exists with 2 ranked skills (should win)
    const ironmanJson = {
      ...sampleJson,
      skills: [
        { id: 0, name: 'Overall', rank: 100, level: 1000, xp: 123456 }, // Ranked
        { id: 1, name: 'Attack', rank: 200, level: 99, xp: 200000000 }, // Ranked
        { id: 24, name: 'Sailing', rank: -1, level: 70, xp: 5000000 },
      ],
    };

    fetchMock
      .mockResolvedValueOnce(createJsonResponse(normalJson))
      .mockResolvedValueOnce(createJsonResponse(ironmanJson))
      .mockResolvedValueOnce(createJsonResponse({}, 404)) // hardcore not found
      .mockResolvedValueOnce(createJsonResponse({}, 404)); // ultimate not found

    const client = new HiscoresClient({ retries: 0 });
    const result = await client.lookupAuto('Test Player');

    // Should return ironman because it has more ranked skills (2 vs 1)
    expect(result.mode).toBe('ironman');
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('uses lookupBatch to continue after errors', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(createJsonResponse(sampleJson))
      .mockResolvedValueOnce(createJsonResponse({}, 404));

    const client = createHiscoresClient({ retries: 0 });
    const results = await client.lookupBatch([
      { username: 'Test Player', mode: 'normal' },
      { username: 'Missing', mode: 'normal' },
    ]);

    expect(results).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
