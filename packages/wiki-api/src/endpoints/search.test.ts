import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WikiSearchClient } from './search';

const createJsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('WikiSearchClient', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parses opensearch responses', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      createJsonResponse([
        'abyssal whip',
        ['Abyssal whip', 'Abyssal whip (or)'],
        ['desc1', 'desc2'],
        [
          'https://oldschool.runescape.wiki/w/Abyssal_whip',
          'https://oldschool.runescape.wiki/w/Abyssal_whip_(or)',
        ],
      ])
    );

    const client = new WikiSearchClient({
      userAgent: 'Skillbound test',
      retries: 0,
    });
    const result = await client.search('abyssal whip', { limit: 2 });

    expect(result.searchTerm).toBe('abyssal whip');
    expect(result.titles).toHaveLength(2);
    expect(result.urls[0]).toContain('Abyssal_whip');
  });

  it('caches search results by default', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      createJsonResponse([
        'cache',
        ['Cache result'],
        ['desc'],
        ['https://oldschool.runescape.wiki/w/Cache_result'],
      ])
    );

    const client = new WikiSearchClient({
      userAgent: 'Skillbound test',
      retries: 0,
    });
    const first = await client.search('cache');
    const second = await client.search('cache');

    expect(first.titles[0]).toBe('Cache result');
    expect(second.titles[0]).toBe('Cache result');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws on non-ok responses', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(createJsonResponse({ error: 'nope' }, 500));

    const client = new WikiSearchClient({
      userAgent: 'Skillbound test',
      retries: 0,
    });

    await expect(client.search('whip')).rejects.toThrow('HTTP 500');
  });
});
