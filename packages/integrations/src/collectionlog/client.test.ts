import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MemoryCache } from '../shared/cache';
import { ParseError } from '../shared/errors';

import {
  CollectionLogNotFoundError,
  CollectionLogRateLimitError,
  CollectionLogServerError,
  createCollectionLogClient,
} from './index';

const createJsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const sampleResponse = {
  collectionLogId: 10,
  userId: 20,
  collectionLog: {
    username: 'Test',
    accountType: 'REGULAR',
    uniqueObtained: 1,
    uniqueItems: 2,
    tabs: {
      Bosses: {
        'Dagannoth Kings': {
          items: [
            { id: 1, name: 'Berserker ring', obtained: true, quantity: 1 },
          ],
          killCount: [{ name: 'Dagannoth Rex', amount: 5 }],
        },
      },
    },
  },
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

describe('CollectionLogClient', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches and caches collection log data', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(createJsonResponse(sampleResponse));

    const client = createCollectionLogClient({ cache: new MemoryCache() });
    const first = await client.getUserCollectionLog('Test');
    const second = await client.getUserCollectionLog('Test');

    expect(first.collectionLog.username).toBe('Test');
    expect(second.collectionLog.uniqueItems).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('passes user agent headers when provided', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementationOnce((input, init) => {
      const requestUrl = getRequestUrl(input);
      expect(requestUrl).toContain('collectionlog');
      const headers = new Headers(init?.headers);
      expect(headers.get('user-agent')).toBe('SkillboundTest');
      return Promise.resolve(createJsonResponse(sampleResponse));
    });

    const client = createCollectionLogClient({
      cache: new MemoryCache(),
      userAgent: 'SkillboundTest',
    });

    const result = await client.getUserCollectionLog('Test');
    expect(result.collectionLogId).toBe(10);
  });

  it('throws not found errors for 404 responses', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(createJsonResponse({}, 404));

    const client = createCollectionLogClient({ cache: new MemoryCache() });

    await expect(client.getUserCollectionLog('Missing')).rejects.toBeInstanceOf(
      CollectionLogNotFoundError
    );
  });

  it('throws rate limit errors for 429 responses', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(() =>
      Promise.resolve(createJsonResponse({}, 429))
    );

    const client = createCollectionLogClient({ cache: new MemoryCache() });

    await expect(
      client.getUserCollectionLog('RateLimited')
    ).rejects.toBeInstanceOf(CollectionLogRateLimitError);
  });

  it('throws server errors for 500 responses', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(() =>
      Promise.resolve(createJsonResponse({ message: 'bad' }, 500))
    );

    const client = createCollectionLogClient({ cache: new MemoryCache() });

    await expect(
      client.getUserCollectionLog('ServerError')
    ).rejects.toBeInstanceOf(CollectionLogServerError);
  });

  it('surfaces error envelopes with error fields', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(() =>
      Promise.resolve(createJsonResponse({ error: 'Boom' }, 500))
    );

    const client = createCollectionLogClient({ cache: new MemoryCache() });

    await expect(
      client.getUserCollectionLog('ServerError')
    ).rejects.toBeInstanceOf(CollectionLogServerError);
  });

  it('throws parse errors for invalid payloads', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(createJsonResponse({ foo: 'bar' }));

    const client = createCollectionLogClient({ cache: new MemoryCache() });

    await expect(client.getUserCollectionLog('Broken')).rejects.toBeInstanceOf(
      ParseError
    );
  });
});
