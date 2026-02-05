import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MemoryCache } from '../shared/cache';
import { ParseError } from '../shared/errors';

import {
  createWiseOldManClient,
  WiseOldManNotFoundError,
  WiseOldManRateLimitError,
  WiseOldManServerError,
} from './index';

const createJsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const samplePlayer = {
  id: 123,
  username: 'Test Player',
  displayName: 'Test Player',
  type: 'regular',
  exp: 123456,
};

const sampleSnapshots = [
  {
    id: 1,
    playerId: 123,
    createdAt: '2024-01-01T00:00:00.000Z',
    data: {
      skills: {},
    },
  },
];

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

describe('WiseOldManClient', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('caches player lookups', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(createJsonResponse(samplePlayer));

    const client = createWiseOldManClient({ cache: new MemoryCache() });
    const first = await client.getPlayer('Test Player');
    const second = await client.getPlayer('Test Player');

    expect(first.username).toBe('Test Player');
    expect(second.username).toBe('Test Player');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws not found errors for 404 responses', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(createJsonResponse({}, 404));

    const client = createWiseOldManClient({ cache: new MemoryCache() });

    await expect(client.getPlayer('Missing')).rejects.toBeInstanceOf(
      WiseOldManNotFoundError
    );
  });

  it('throws rate limit errors for 429 responses', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(() =>
      Promise.resolve(createJsonResponse({}, 429))
    );

    const client = createWiseOldManClient({ cache: new MemoryCache() });

    await expect(client.getPlayer('RateLimited')).rejects.toBeInstanceOf(
      WiseOldManRateLimitError
    );
  });

  it('throws parse errors for invalid payloads', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(createJsonResponse({}));

    const client = createWiseOldManClient({ cache: new MemoryCache() });

    await expect(client.getPlayer('Broken')).rejects.toBeInstanceOf(ParseError);
  });

  it('supports update calls', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(createJsonResponse(samplePlayer));

    const client = createWiseOldManClient({ cache: new MemoryCache() });
    const result = await client.updatePlayer('Test Player');

    expect(result.id).toBe(123);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('fetches snapshots with query options and user agent', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementationOnce((input, init) => {
      const requestUrl = getRequestUrl(input);
      expect(requestUrl).toContain('period=week');
      expect(requestUrl).toContain('startDate=2024-01-01');
      expect(requestUrl).toContain('endDate=2024-01-31');

      const headers = new Headers(init?.headers);
      expect(headers.get('user-agent')).toBe('SkillboundTest');

      return Promise.resolve(createJsonResponse(sampleSnapshots));
    });

    const client = createWiseOldManClient({ userAgent: 'SkillboundTest' });
    const result = await client.getPlayerSnapshots('Test Player', {
      period: 'week',
      startDate: '2024-01-01',
      endDate: '2024-01-31',
    });

    expect(result).toHaveLength(1);
  });

  it('throws server errors for 500 responses', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(() =>
      Promise.resolve(createJsonResponse({}, 500))
    );

    const client = createWiseOldManClient({ cache: new MemoryCache() });

    await expect(client.getPlayer('ServerError')).rejects.toBeInstanceOf(
      WiseOldManServerError
    );
  });

  it('falls back to generic server errors when no message is provided', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ statusCode: 500 }), { status: 500 })
      )
    );

    const client = createWiseOldManClient({ cache: new MemoryCache() });

    await expect(client.getPlayer('ServerError')).rejects.toBeInstanceOf(
      WiseOldManServerError
    );
  });

  it('uses upstream error messages when provided', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(() =>
      Promise.resolve(createJsonResponse({ message: 'Upstream fail' }, 500))
    );

    const client = createWiseOldManClient({ cache: new MemoryCache() });

    await expect(client.getPlayer('ServerError')).rejects.toBeInstanceOf(
      WiseOldManServerError
    );
  });
});
