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
