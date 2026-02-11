import type { WikiPricesClient } from '@skillbound/wiki-api';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  filterGeItems,
  formatGp,
  getItemTimeseries,
  parseGp,
  type GeExchangeItem,
} from './ge-service';

type GetTimeseriesOptions = Parameters<WikiPricesClient['getTimeseries']>[0];
type TimeseriesResponse = Awaited<
  ReturnType<WikiPricesClient['getTimeseries']>
>;

const getTimeseriesMock = vi.hoisted(() =>
  vi.fn<(options: GetTimeseriesOptions) => Promise<TimeseriesResponse>>()
);
const get5MinutePricesMock = vi.hoisted(() => vi.fn());
const get1HourPricesMock = vi.hoisted(() => vi.fn());
const createWikiPricesClientMock = vi.hoisted(() =>
  vi.fn(() => ({
    getTimeseries: getTimeseriesMock,
    get5MinutePrices: get5MinutePricesMock,
    get1HourPrices: get1HourPricesMock,
  }))
);

vi.mock('@skillbound/wiki-api', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    createWikiPricesClient: createWikiPricesClientMock,
  };
});

describe('getItemTimeseries', () => {
  beforeEach(() => {
    getTimeseriesMock.mockReset();
    get5MinutePricesMock.mockReset();
    get1HourPricesMock.mockReset();
    createWikiPricesClientMock.mockClear();
    get5MinutePricesMock.mockResolvedValue({ prices: new Map() });
    get1HourPricesMock.mockResolvedValue({ prices: new Map() });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('requests 1w data with a 1h timestep (API does not support start param)', async () => {
    vi.useFakeTimers();
    const now = new Date('2026-01-27T00:00:00Z');
    vi.setSystemTime(now);

    getTimeseriesMock.mockResolvedValue({
      itemId: 42,
      timestep: '1h',
      points: [],
    });

    await getItemTimeseries(42, '1w');

    const options = getTimeseriesMock.mock.calls[0]?.[0];

    // Wiki API timeseries endpoint doesn't support start/end params,
    // we only pass itemId and timestep, then filter client-side
    expect(options).toMatchObject({
      itemId: 42,
      timestep: '1h',
    });
  });

  it('maps timeseries points into price points', async () => {
    vi.useFakeTimers();
    const now = new Date('2026-01-27T12:00:00Z');
    vi.setSystemTime(now);

    // Timestamp within the last 24 hours (6 hours ago)
    const recentTimestamp = Math.floor(now.getTime() / 1000) - 6 * 60 * 60;

    getTimeseriesMock.mockResolvedValue({
      itemId: 99,
      timestep: '5m',
      points: [
        {
          timestamp: recentTimestamp,
          avgHighPrice: 100,
          avgLowPrice: 90,
          highPriceVolume: 4,
          lowPriceVolume: 6,
        },
      ],
    });

    const result = await getItemTimeseries(99, 'live');

    expect(result).toHaveLength(1);
    expect(result[0]?.timestamp).toEqual(new Date(recentTimestamp * 1000));
    expect(result[0]?.buyPrice).toBe(100);
    expect(result[0]?.sellPrice).toBe(90);
    expect(result[0]?.volume).toBe(10);
  });

  it('filters out data points older than the requested period', async () => {
    vi.useFakeTimers();
    const now = new Date('2026-01-27T12:00:00Z');
    vi.setSystemTime(now);

    const nowTs = Math.floor(now.getTime() / 1000);
    const recentTimestamp = nowTs - 6 * 60 * 60; // 6 hours ago (within 24h)
    const oldTimestamp = nowTs - 48 * 60 * 60; // 48 hours ago (outside 24h)

    getTimeseriesMock.mockResolvedValue({
      itemId: 99,
      timestep: '5m',
      points: [
        {
          timestamp: oldTimestamp,
          avgHighPrice: 50,
          avgLowPrice: 40,
          highPriceVolume: 1,
          lowPriceVolume: 1,
        },
        {
          timestamp: recentTimestamp,
          avgHighPrice: 100,
          avgLowPrice: 90,
          highPriceVolume: 4,
          lowPriceVolume: 6,
        },
      ],
    });

    const result = await getItemTimeseries(99, 'live');

    // Only the recent point should be returned (old one filtered out)
    expect(result).toHaveLength(1);
    expect(result[0]?.timestamp).toEqual(new Date(recentTimestamp * 1000));
    expect(result[0]?.buyPrice).toBe(100);
  });
});

describe('filterGeItems', () => {
  const items: GeExchangeItem[] = [
    {
      id: 1,
      name: 'Abyssal whip',
      examine: '',
      members: true,
      icon: 'Abyssal whip.png',
      buyLimit: 70,
      lowAlch: null,
      highAlch: null,
      value: 0,
      buyPrice: 2_500_000,
      sellPrice: 2_450_000,
      buyPriceTime: null,
      sellPriceTime: null,
      margin: 50_000,
      tax: 25_000,
      profit: 25_000,
      roiPercent: 1.02,
      potentialProfit: 1_750_000,
      volume: 120,
      avgHighPrice: 2_520_000,
      avgLowPrice: 2_440_000,
      volume5m: null,
      volume1h: null,
      avgHighPrice5m: null,
      avgLowPrice5m: null,
      avgHighPrice1h: null,
      avgLowPrice1h: null,
    },
    {
      id: 2,
      name: 'Rune scimitar',
      examine: '',
      members: false,
      icon: 'Rune scimitar.png',
      buyLimit: 70,
      lowAlch: null,
      highAlch: null,
      value: 0,
      buyPrice: 14_000,
      sellPrice: 13_500,
      buyPriceTime: null,
      sellPriceTime: null,
      margin: 500,
      tax: 140,
      profit: 360,
      roiPercent: 2.67,
      potentialProfit: 25_200,
      volume: 980,
      avgHighPrice: 14_200,
      avgLowPrice: 13_400,
      volume5m: null,
      volume1h: null,
      avgHighPrice5m: null,
      avgLowPrice5m: null,
      avgHighPrice1h: null,
      avgLowPrice1h: null,
    },
  ];

  it('filters by members and min profit', () => {
    const result = filterGeItems(items, { members: true, minProfit: 1000 });
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(1);
  });

  it('filters by min volume and min ROI', () => {
    const result = filterGeItems(items, { minVolume: 500, minRoi: 2 });
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(2);
  });

  it('filters by search text', () => {
    const result = filterGeItems(items, { search: 'whip' });
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(1);
  });

  it('returns all items when no filters are applied', () => {
    const result = filterGeItems(items, {});
    expect(result).toHaveLength(2);
  });

  it('filters by non-members (f2p)', () => {
    const result = filterGeItems(items, { members: false });
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(2);
  });

  it('filters by max buy price', () => {
    const result = filterGeItems(items, { maxBuyPrice: 100_000 });
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(2);
  });

  it('filters by min margin', () => {
    const result = filterGeItems(items, { minMargin: 1000 });
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(1);
  });

  it('filters by minFlipQuality grade', () => {
    // Add flipQuality scores to items
    const scoredItems: GeExchangeItem[] = [
      {
        ...items[0]!,
        flipQuality: {
          grade: 'B',
          score: 72,
          breakdown: {
            liquidity: 70,
            staleness: 85,
            marginStability: 70,
            volumeAdequacy: 55,
            buyPressure: 65,
            taxEfficiency: 85,
          },
          flags: [],
        },
      },
      {
        ...items[1]!,
        flipQuality: {
          grade: 'D',
          score: 42,
          breakdown: {
            liquidity: 40,
            staleness: 40,
            marginStability: 40,
            volumeAdequacy: 40,
            buyPressure: 50,
            taxEfficiency: 55,
          },
          flags: ['low-volume'],
        },
      },
    ];

    // Filter for B+ should only return item 1
    const result = filterGeItems(scoredItems, { minFlipQuality: 'B' });
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(1);

    // Filter for D+ should return both
    const resultD = filterGeItems(scoredItems, { minFlipQuality: 'D' });
    expect(resultD).toHaveLength(2);
  });

  it('minFlipQuality filter excludes items with null flipQuality', () => {
    // items already have flipQuality: undefined (not set in the original fixtures)
    const result = filterGeItems(items, { minFlipQuality: 'F' });
    expect(result).toHaveLength(0);
  });

  it('combines multiple filters', () => {
    const result = filterGeItems(items, {
      members: true,
      minProfit: 1000,
      minVolume: 100,
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(1);
  });

  it('search is case-insensitive', () => {
    const result = filterGeItems(items, { search: 'ABYSSAL' });
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// formatGp
// ---------------------------------------------------------------------------

describe('formatGp', () => {
  it('returns dash for null', () => {
    expect(formatGp(null)).toBe('-');
  });

  it('formats small values with locale string', () => {
    expect(formatGp(0)).toBe('0');
    expect(formatGp(999)).toBe('999');
  });

  it('formats thousands with k suffix', () => {
    expect(formatGp(1_000)).toBe('1.0k');
    expect(formatGp(5_500)).toBe('5.5k');
    expect(formatGp(50_000)).toBe('50.0k');
    expect(formatGp(999_999)).toBe('1000.0k');
  });

  it('formats millions with m suffix', () => {
    expect(formatGp(1_000_000)).toBe('1.00m');
    expect(formatGp(25_500_000)).toBe('25.50m');
    expect(formatGp(100_000_000)).toBe('100.00m');
  });

  it('formats billions with b suffix', () => {
    expect(formatGp(1_000_000_000)).toBe('1.00b');
    expect(formatGp(2_147_483_647)).toBe('2.15b');
  });

  it('handles negative values', () => {
    expect(formatGp(-5_000)).toBe('-5.0k');
    expect(formatGp(-2_500_000)).toBe('-2.50m');
    expect(formatGp(-1_000_000_000)).toBe('-1.00b');
  });
});

// ---------------------------------------------------------------------------
// parseGp
// ---------------------------------------------------------------------------

describe('parseGp', () => {
  it('returns null for empty/invalid input', () => {
    expect(parseGp('')).toBeNull();
    expect(parseGp('   ')).toBeNull();
    expect(parseGp('abc')).toBeNull();
    expect(parseGp('--5')).toBeNull();
  });

  it('parses plain numbers', () => {
    expect(parseGp('100')).toBe(100);
    expect(parseGp('0')).toBe(0);
    expect(parseGp('999999')).toBe(999999);
  });

  it('parses k suffix', () => {
    expect(parseGp('1k')).toBe(1_000);
    expect(parseGp('5.5k')).toBe(5_500);
    expect(parseGp('500k')).toBe(500_000);
  });

  it('parses m suffix', () => {
    expect(parseGp('1m')).toBe(1_000_000);
    expect(parseGp('4m')).toBe(4_000_000);
    expect(parseGp('1.5m')).toBe(1_500_000);
    expect(parseGp('25.5m')).toBe(25_500_000);
  });

  it('parses b suffix', () => {
    expect(parseGp('1b')).toBe(1_000_000_000);
    expect(parseGp('2.1b')).toBe(2_100_000_000);
  });

  it('ignores commas and spaces', () => {
    expect(parseGp('1,000,000')).toBe(1_000_000);
    expect(parseGp('2,500')).toBe(2_500);
    expect(parseGp(' 5k ')).toBe(5_000);
  });

  it('is case-insensitive', () => {
    expect(parseGp('5K')).toBe(5_000);
    expect(parseGp('1M')).toBe(1_000_000);
    expect(parseGp('2B')).toBe(2_000_000_000);
  });

  it('rejects negative values', () => {
    expect(parseGp('-5k')).toBeNull();
    expect(parseGp('-1m')).toBeNull();
  });
});
