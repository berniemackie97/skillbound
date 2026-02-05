import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MemoryCache } from '../shared/cache';
import { ParseError } from '../shared/errors';

import {
  createTempleClient,
  TempleNotFoundError,
  TempleRateLimitError,
  TempleServerError,
} from './index';

const createJsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const sampleInfo = {
  status: 'success',
  data: {
    username: 'Mikael',
    player_id: 42,
  },
};

const sampleArray = {
  status: 'success',
  data: [
    { timestamp: 123, value: 1 },
    { timestamp: 124, value: 2 },
  ],
};

const getRequestUrl = (input: unknown): string => {
  if (typeof input === 'string') {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }
  if (input && typeof input === 'object' && 'url' in input) {
    const url = (input as { url?: unknown }).url;
    return typeof url === 'string' ? url : '';
  }
  return '';
};

describe('TempleClient', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns player info and caches it', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(createJsonResponse(sampleInfo));

    const client = createTempleClient({ cache: new MemoryCache() });
    const first = await client.getPlayerInfo('Mikael');
    const second = await client.getPlayerInfo('Mikael');

    if (!Array.isArray(first) && !Array.isArray(second)) {
      expect(first['username']).toBe('Mikael');
      expect(second['player_id']).toBe(42);
    }
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws on error envelopes', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({ status: 'error', error: 'Player not found' }, 200)
    );

    const client = createTempleClient({ cache: new MemoryCache() });
    await expect(client.getPlayerInfo('Missing')).rejects.toBeInstanceOf(
      TempleServerError
    );
  });

  it('throws when success envelopes include an error field', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({ status: 'success', error: 'Boom' }, 200)
    );

    const client = createTempleClient({ cache: new MemoryCache() });
    await expect(client.getPlayerInfo('Missing')).rejects.toBeInstanceOf(
      TempleServerError
    );
  });

  it('throws not found errors for 404 responses', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(createJsonResponse({}, 404));

    const client = createTempleClient({ cache: new MemoryCache() });

    await expect(client.getPlayerStats('Missing')).rejects.toBeInstanceOf(
      TempleNotFoundError
    );
  });

  it('throws rate limit errors for 429 responses', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(() =>
      Promise.resolve(createJsonResponse({}, 429))
    );

    const client = createTempleClient({ cache: new MemoryCache() });

    await expect(client.getPlayerStats('Mikael')).rejects.toBeInstanceOf(
      TempleRateLimitError
    );
  });

  it('throws server errors for 500 responses', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(() =>
      Promise.resolve(createJsonResponse({}, 500))
    );

    const client = createTempleClient({ cache: new MemoryCache() });

    await expect(client.getPlayerStats('Mikael')).rejects.toBeInstanceOf(
      TempleServerError
    );
  });

  it('supports gains and datapoints endpoints', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(createJsonResponse(sampleArray))
      .mockResolvedValueOnce(createJsonResponse(sampleArray));

    const client = createTempleClient({ cache: new MemoryCache() });
    const gains = await client.getPlayerGains('Mikael', 'week');
    const datapoints = await client.getPlayerDatapoints('Mikael', 'month');

    expect(Array.isArray(gains)).toBe(true);
    expect(Array.isArray(datapoints)).toBe(true);
  });

  it('passes user agent headers when provided', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementationOnce((input, init) => {
      const requestUrl = getRequestUrl(input);
      expect(requestUrl).toContain('player_info.php');
      const headers = new Headers(init?.headers);
      expect(headers.get('user-agent')).toBe('SkillboundTest');
      return Promise.resolve(createJsonResponse(sampleInfo));
    });

    const client = createTempleClient({
      cache: new MemoryCache(),
      userAgent: 'SkillboundTest',
    });
    const result = await client.getPlayerInfo('Mikael');

    if (!Array.isArray(result)) {
      expect(result['username']).toBe('Mikael');
    }
  });

  it('accepts unwrapped array payloads', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      createJsonResponse([{ timestamp: 1, value: 99 }])
    );

    const client = createTempleClient({ cache: new MemoryCache() });
    const datapoints = await client.getPlayerDatapoints('Mikael', 'week');

    expect(Array.isArray(datapoints)).toBe(true);
  });

  it('throws parse errors for invalid payloads', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(createJsonResponse(null));

    const client = createTempleClient({ cache: new MemoryCache() });

    await expect(client.getPlayerInfo('Mikael')).rejects.toBeInstanceOf(
      ParseError
    );
  });

  it('supports cache-disabled clients', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(createJsonResponse(sampleInfo));

    const client = createTempleClient({ cache: null });
    const result = await client.getPlayerInfo('Mikael');

    if (!Array.isArray(result)) {
      expect(result['username']).toBe('Mikael');
    }
  });
});
