import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MemoryCache } from '../shared/cache';
import { ParseError } from '../shared/errors';

import {
  createOsrsBoxClient,
  OsrsBoxNotFoundError,
  OsrsBoxServerError,
} from './index';

const createJsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const sampleItem = {
  id: 4151,
  name: 'Abyssal whip',
  members: true,
};

const sampleMonster = {
  id: 50,
  name: 'KBD',
};

describe('OsrsBoxClient', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('caches item lookups', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(createJsonResponse(sampleItem));

    const client = createOsrsBoxClient({ cache: new MemoryCache() });
    const first = await client.getItem(4151);
    const second = await client.getItem(4151);

    expect(first.name).toBe('Abyssal whip');
    expect(second.id).toBe(4151);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws not found errors for missing items', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(createJsonResponse({}, 404));

    const client = createOsrsBoxClient({ cache: new MemoryCache() });

    await expect(client.getItem(9999)).rejects.toBeInstanceOf(
      OsrsBoxNotFoundError
    );
  });

  it('fetches monsters', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(createJsonResponse(sampleMonster));

    const client = createOsrsBoxClient({ cache: new MemoryCache() });
    const monster = await client.getMonster(50);

    expect(monster.name).toBe('KBD');
  });

  it('fetches multiple items', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(createJsonResponse(sampleItem))
      .mockResolvedValueOnce(
        createJsonResponse({ id: 11840, name: 'Dragon boots' })
      );

    const client = createOsrsBoxClient({ cache: new MemoryCache() });
    const items = await client.getItems([4151, 11840]);

    expect(items).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws server errors for 500 responses', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(() =>
      Promise.resolve(createJsonResponse({}, 500))
    );

    const client = createOsrsBoxClient({ cache: new MemoryCache() });

    await expect(client.getMonster(123)).rejects.toBeInstanceOf(
      OsrsBoxServerError
    );
  });

  it('throws parse errors for invalid payloads', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(createJsonResponse({ foo: 'bar' }));

    const client = createOsrsBoxClient({ cache: new MemoryCache() });

    await expect(client.getItem(4151)).rejects.toBeInstanceOf(ParseError);
  });
});
