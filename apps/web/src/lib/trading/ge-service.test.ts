import type * as WikiApi from '@skillbound/wiki-api';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  filterGeItems,
  getItemTimeseries,
  type GeExchangeItem,
} from './ge-service';

type GetTimeseriesOptions = Parameters<
  WikiApi.WikiPricesClient['getTimeseries']
>[0];
type TimeseriesResponse = Awaited<
  ReturnType<WikiApi.WikiPricesClient['getTimeseries']>
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
  const actual = (await importOriginal()) as typeof import('@skillbound/wiki-api');
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
});
