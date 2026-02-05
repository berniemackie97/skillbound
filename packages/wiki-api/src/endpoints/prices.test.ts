import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WikiPricesClient } from './prices';

const createJsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('WikiPricesClient', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parses latest prices', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        data: {
          '4151': {
            high: 1375111,
            highTime: 1769055034,
            low: 1349285,
            lowTime: 1769054962,
          },
        },
      })
    );

    const client = new WikiPricesClient({
      userAgent: 'Skillbound test',
      retries: 0,
    });
    const result = await client.getLatestPrices(4151);

    const price = result.prices.get(4151);
    expect(price?.high).toBe(1375111);
    expect(price?.lowTime).toBe(1769054962);
  });

  it('caches latest prices', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        data: {
          '100': { high: 10, highTime: 1, low: 9, lowTime: 2 },
        },
      })
    );

    const client = new WikiPricesClient({
      userAgent: 'Skillbound test',
      retries: 0,
    });
    const first = await client.getLatestPrices(100);
    const second = await client.getLatestPrices(100);

    expect(first.prices.get(100)?.high).toBe(10);
    expect(second.prices.get(100)?.low).toBe(9);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('requests the all-items latest endpoint when no item id is provided', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        data: {
          '1': { high: 10, highTime: 1, low: 9, lowTime: 2 },
        },
      })
    );

    const client = new WikiPricesClient({
      userAgent: 'Skillbound test',
      retries: 0,
    });
    await client.getLatestPrices();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/latest'),
      expect.any(Object)
    );
  });

  it('skips cache when cache is null for latest prices', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        createJsonResponse({
          data: {
            '200': { high: 20, highTime: 1, low: 18, lowTime: 2 },
          },
        })
      )
    );

    const client = new WikiPricesClient({
      userAgent: 'Skillbound test',
      retries: 0,
      cache: null,
    });
    await client.getLatestPrices(200);
    await client.getLatestPrices(200);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('parses 5-minute prices with array payloads', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        data: [
          {
            id: 2,
            avgHighPrice: 221,
            avgLowPrice: 213,
            volume: 123,
            timestamp: 1700000000,
          },
        ],
      })
    );

    const client = new WikiPricesClient({
      userAgent: 'Skillbound test',
      retries: 0,
    });
    const result = await client.get5MinutePrices();

    const price = result.prices.get(2);
    expect(price?.avgHighPrice).toBe(221);
    expect(price?.volume).toBe(123);
    expect(price?.timestamp).toBe(1700000000);
  });

  it('supports legacy 5-minute payloads', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        data: {
          '3': {
            avgHighPrice: 999,
            highPriceVolume: 1,
            avgLowPrice: 950,
            lowPriceVolume: 2,
          },
        },
      })
    );

    const client = new WikiPricesClient({
      userAgent: 'Skillbound test',
      retries: 0,
    });
    const result = await client.get5MinutePrices(1700000000);

    const price = result.prices.get(3);
    expect(price?.avgLowPrice).toBe(950);
    expect(price?.highPriceVolume).toBe(1);
  });

  it('derives volume from high/low volumes when missing', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        data: [
          {
            id: 7,
            avgHighPrice: 500,
            avgLowPrice: 450,
            highPriceVolume: 3,
            lowPriceVolume: 2,
          },
        ],
      })
    );

    const client = new WikiPricesClient({
      userAgent: 'Skillbound test',
      retries: 0,
    });
    const result = await client.get5MinutePrices();

    const price = result.prices.get(7);
    expect(price?.volume).toBe(5);
  });

  it('falls back to null volume when derived volume is zero', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        data: {
          '8': {
            avgHighPrice: 500,
            avgLowPrice: 450,
            highPriceVolume: 0,
            lowPriceVolume: 0,
          },
        },
      })
    );

    const client = new WikiPricesClient({
      userAgent: 'Skillbound test',
      retries: 0,
    });
    const result = await client.get5MinutePrices();

    const price = result.prices.get(8);
    expect(price?.volume).toBeNull();
  });

  it('falls back to legacy 5-minute endpoint when needed', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(createJsonResponse({ error: 'not found' }, 404))
      .mockResolvedValueOnce(
        createJsonResponse({
          data: {
            '4': {
              avgHighPrice: 111,
              highPriceVolume: 5,
              avgLowPrice: 100,
              lowPriceVolume: 3,
            },
          },
        })
      );

    const client = new WikiPricesClient({
      userAgent: 'Skillbound test',
      retries: 0,
    });
    const result = await client.get5MinutePrices();

    const price = result.prices.get(4);
    expect(price?.avgHighPrice).toBe(111);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('parses 1-hour prices', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        data: [
          {
            id: 4151,
            avgHighPrice: 2000000,
            avgLowPrice: 1900000,
            volume: 42,
            timestamp: 1700001000,
          },
        ],
      })
    );

    const client = new WikiPricesClient({
      userAgent: 'Skillbound test',
      retries: 0,
    });
    const result = await client.get1HourPrices();

    const price = result.prices.get(4151);
    expect(price?.avgHighPrice).toBe(2000000);
    expect(price?.volume).toBe(42);
  });

  it('falls back to legacy 1-hour endpoint when needed', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(createJsonResponse({ error: 'not found' }, 404))
      .mockResolvedValueOnce(
        createJsonResponse({
          data: {
            '5': {
              avgHighPrice: 500,
              highPriceVolume: 2,
              avgLowPrice: 450,
              lowPriceVolume: 1,
            },
          },
        })
      );

    const client = new WikiPricesClient({
      userAgent: 'Skillbound test',
      retries: 0,
    });
    const result = await client.get1HourPrices();

    const price = result.prices.get(5);
    expect(price?.avgHighPrice).toBe(500);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('caches interval price requests', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        data: [
          {
            id: 10,
            avgHighPrice: 50,
            avgLowPrice: 40,
            volume: 12,
            timestamp: 1700002000,
          },
        ],
      })
    );

    const client = new WikiPricesClient({
      userAgent: 'Skillbound test',
      retries: 0,
    });
    const first = await client.get1HourPrices();
    const second = await client.get1HourPrices();

    expect(first.prices.get(10)?.avgLowPrice).toBe(40);
    expect(second.prices.get(10)?.avgHighPrice).toBe(50);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('parses timeseries data', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        data: [
          {
            timestamp: 1700000000,
            avgHighPrice: 100,
            avgLowPrice: 90,
            highPriceVolume: 10,
            lowPriceVolume: 8,
          },
        ],
      })
    );

    const client = new WikiPricesClient({
      userAgent: 'Skillbound test',
      retries: 0,
    });
    const result = await client.getTimeseries({ itemId: 4151, timestep: '5m' });

    expect(result.itemId).toBe(4151);
    expect(result.points[0]?.avgLowPrice).toBe(90);
  });

  it('defaults timeseries timestep to 5m', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        data: [
          {
            timestamp: 1700000002,
            avgHighPrice: 300,
            avgLowPrice: 290,
            highPriceVolume: 3,
            lowPriceVolume: 1,
          },
        ],
      })
    );

    const client = new WikiPricesClient({
      userAgent: 'Skillbound test',
      retries: 0,
    });
    const result = await client.getTimeseries({ itemId: 99 });

    expect(result.timestep).toBe('5m');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('timestep=5m'),
      expect.any(Object)
    );
  });

  it('caches timeseries data', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        data: [
          {
            timestamp: 1700000001,
            avgHighPrice: 200,
            avgLowPrice: 190,
            highPriceVolume: 2,
            lowPriceVolume: 1,
          },
        ],
      })
    );

    const client = new WikiPricesClient({
      userAgent: 'Skillbound test',
      retries: 0,
    });
    const first = await client.getTimeseries({ itemId: 555, timestep: '1h' });
    const second = await client.getTimeseries({ itemId: 555, timestep: '1h' });

    expect(first.points[0]?.avgHighPrice).toBe(200);
    expect(second.points[0]?.avgLowPrice).toBe(190);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('parses item mappings', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      createJsonResponse([
        {
          id: 4151,
          name: 'Abyssal whip',
          examine: 'A weapon from the abyss.',
          members: true,
          lowalch: 120000,
          highalch: 180000,
          limit: 70,
          value: 120000,
          icon: 'Abyssal whip.png',
        },
      ])
    );

    const client = new WikiPricesClient({
      userAgent: 'Skillbound test',
      retries: 0,
    });
    const mappings = await client.getItemMappings();

    expect(mappings).toHaveLength(1);
    expect(mappings[0]?.name).toBe('Abyssal whip');
    expect(mappings[0]?.limit).toBe(70);
  });

  it('caches mapping requests by default', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      createJsonResponse([
        {
          id: 1,
          name: 'Cache item',
          examine: 'Cached.',
          members: false,
          lowalch: null,
          highalch: null,
          limit: null,
          value: 1,
          icon: 'Cache.png',
        },
      ])
    );

    const client = new WikiPricesClient({
      userAgent: 'Skillbound test',
      retries: 0,
    });
    const first = await client.getItemMappings();
    const second = await client.getItemMappings();

    expect(first[0]?.name).toBe('Cache item');
    expect(second[0]?.name).toBe('Cache item');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws on non-ok responses', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(createJsonResponse({ error: 'nope' }, 500));

    const client = new WikiPricesClient({
      userAgent: 'Skillbound test',
      retries: 0,
    });

    await expect(client.getLatestPrices()).rejects.toThrow('HTTP 500');
  });
});
