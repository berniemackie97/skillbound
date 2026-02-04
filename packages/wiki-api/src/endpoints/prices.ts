import { MemoryCache, type CacheAdapter } from '@skillbound/cache';
import pRetry from 'p-retry';
import { z } from 'zod';

/**
 * Price data for a single item
 */
export interface LatestItemPrice {
  itemId: number;
  high: number | null;
  highTime: number | null;
  low: number | null;
  lowTime: number | null;
}

export interface IntervalItemPrice {
  itemId: number;
  avgHighPrice: number | null;
  avgLowPrice: number | null;
  volume: number | null;
  highPriceVolume?: number | null;
  lowPriceVolume?: number | null;
  timestamp: number | null;
}

export type FiveMinuteItemPrice = IntervalItemPrice;
export type OneHourItemPrice = IntervalItemPrice;

export interface TimeseriesPoint {
  timestamp: number;
  avgHighPrice: number | null;
  avgLowPrice: number | null;
  highPriceVolume: number | null;
  lowPriceVolume: number | null;
  volume?: number | null | undefined;
}

/**
 * Real-time prices response
 */
export interface PricesResponse<T> {
  timestamp: string;
  prices: Map<number, T>;
}

export interface TimeseriesResponse {
  itemId: number;
  timestep: TimeseriesTimestep;
  points: TimeseriesPoint[];
}

/**
 * Item mapping entry
 */
export interface ItemMapping {
  id: number;
  name: string;
  examine: string;
  members: boolean;
  lowalch?: number | null | undefined;
  highalch?: number | null | undefined;
  limit?: number | null | undefined;
  value?: number | undefined;
  icon: string;
}

const LatestPriceDataSchema = z.object({
  high: z.number().nullable(),
  highTime: z.number().nullable(),
  low: z.number().nullable(),
  lowTime: z.number().nullable(),
});

const IntervalPriceDataSchema = z.object({
  avgHighPrice: z.number().nullable(),
  avgLowPrice: z.number().nullable(),
  highPriceVolume: z.number().nullable().optional(),
  lowPriceVolume: z.number().nullable().optional(),
  volume: z.number().nullable().optional(),
  timestamp: z.number().int().nullable().optional(),
});

const LatestPricesSchema = z.object({
  data: z.record(z.string(), LatestPriceDataSchema),
});

const IntervalPricesRecordSchema = z.object({
  data: z.record(z.string(), IntervalPriceDataSchema),
});

const IntervalPricesArraySchema = z.object({
  data: z.array(
    IntervalPriceDataSchema.extend({
      id: z.number(),
    })
  ),
});

const IntervalPricesSchema = z.union([
  IntervalPricesRecordSchema,
  IntervalPricesArraySchema,
]);

const TimeseriesPointSchema = z.object({
  timestamp: z.number().int(),
  avgHighPrice: z.number().nullable(),
  avgLowPrice: z.number().nullable(),
  highPriceVolume: z.number().nullable(),
  lowPriceVolume: z.number().nullable(),
  volume: z.number().nullable().optional(),
});

const TimeseriesSchema = z.object({
  data: z.array(TimeseriesPointSchema),
});

const MappingSchema = z.array(
  z.object({
    id: z.number(),
    name: z.string(),
    examine: z.string(),
    members: z.boolean(),
    lowalch: z.number().nullable().optional(),
    highalch: z.number().nullable().optional(),
    limit: z.number().nullable().optional(),
    value: z.number().optional(),
    icon: z.string(),
  })
);

/**
 * OSRS Wiki Real-Time Prices API Client
 * Documentation: https://oldschool.runescape.wiki/w/RuneScape:Real-time_Prices
 */
export type TimeseriesTimestep = '5m' | '1h' | '6h' | '24h';

export class WikiPricesClient {
  private readonly baseUrl: string;
  private readonly userAgent: string;
  private readonly retries: number;
  private readonly timeoutMs: number;
  private readonly cache: CacheAdapter | null;
  private readonly cacheTtlMs: number;

  constructor(config: {
    userAgent: string;
    baseUrl?: string;
    retries?: number;
    timeoutMs?: number;
    cache?: CacheAdapter | null;
    cacheTtlMs?: number;
  }) {
    this.baseUrl =
      config.baseUrl ?? 'https://prices.runescape.wiki/api/v1/osrs';
    this.userAgent = config.userAgent;
    this.retries = config.retries ?? 3;
    this.timeoutMs = config.timeoutMs ?? 10000;
    this.cache = config.cache ?? new MemoryCache();
    this.cacheTtlMs = config.cacheTtlMs ?? 10 * 60 * 1000;
  }

  /**
   * Get latest prices for all items or specific item(s)
   */
  async getLatestPrices(
    itemId?: number
  ): Promise<PricesResponse<LatestItemPrice>> {
    const url = itemId
      ? `${this.baseUrl}/latest?id=${itemId}`
      : `${this.baseUrl}/latest`;
    const cacheKey = `prices:latest:${itemId ?? 'all'}`;

    if (this.cache) {
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return cached as PricesResponse<LatestItemPrice>;
      }
    }

    const result = await pRetry(
      async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'User-Agent': this.userAgent,
            Accept: 'application/json',
          },
        }).finally(() => clearTimeout(timeoutId));

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const json = await response.json();
        const parsed = LatestPricesSchema.parse(json);

        const prices = new Map<number, LatestItemPrice>();
        for (const [id, data] of Object.entries(parsed.data)) {
          const itemId = parseInt(id, 10);
          prices.set(itemId, {
            itemId,
            high: data.high,
            highTime: data.highTime,
            low: data.low,
            lowTime: data.lowTime,
          });
        }

        return {
          timestamp: new Date().toISOString(),
          prices,
        };
      },
      {
        retries: this.retries,
        onFailedAttempt: ({ error, attemptNumber }) => {
          console.warn(
            `Price fetch attempt ${attemptNumber} failed:`,
            error.message
          );
        },
      }
    );

    if (this.cache) {
      await this.cache.set(cacheKey, result, this.cacheTtlMs);
    }

    return result;
  }

  /**
   * Get item metadata mappings
   */
  async getItemMappings(): Promise<ItemMapping[]> {
    const url = `${this.baseUrl}/mapping`;
    const cacheKey = 'prices:mapping';

    if (this.cache) {
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return cached as ItemMapping[];
      }
    }

    const result = await pRetry(
      async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'User-Agent': this.userAgent,
            Accept: 'application/json',
          },
        }).finally(() => clearTimeout(timeoutId));

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const json = await response.json();
        return MappingSchema.parse(json);
      },
      {
        retries: this.retries,
        onFailedAttempt: ({ error, attemptNumber }) => {
          console.warn(
            `Mapping fetch attempt ${attemptNumber} failed:`,
            error.message
          );
        },
      }
    );

    if (this.cache) {
      await this.cache.set(cacheKey, result, this.cacheTtlMs);
    }

    return result;
  }

  /**
   * Get 5-minute averaged prices
   */
  async get5MinutePrices(
    timestamp?: number
  ): Promise<PricesResponse<IntervalItemPrice>> {
    return this.getIntervalPrices('5m', timestamp);
  }

  /**
   * Get 1-hour averaged prices
   */
  async get1HourPrices(
    timestamp?: number
  ): Promise<PricesResponse<IntervalItemPrice>> {
    return this.getIntervalPrices('1h', timestamp);
  }

  /**
   * Get timeseries data for a specific item
   *
   * Note: The Wiki API timeseries endpoint only supports `id` and `timestep` parameters.
   * It returns up to 365 data points automatically based on the timestep interval.
   * Filtering by time range must be done client-side.
   */
  async getTimeseries(options: {
    itemId: number;
    timestep?: TimeseriesTimestep;
  }): Promise<TimeseriesResponse> {
    const timestep = options.timestep ?? '5m';
    const url = `${this.baseUrl}/timeseries?id=${options.itemId}&timestep=${timestep}`;
    const cacheKey = `prices:timeseries:${options.itemId}:${timestep}`;

    if (this.cache) {
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return cached as TimeseriesResponse;
      }
    }

    const result = await pRetry(
      async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'User-Agent': this.userAgent,
            Accept: 'application/json',
          },
        }).finally(() => clearTimeout(timeoutId));

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const json = await response.json();
        const parsed = TimeseriesSchema.parse(json);

        return {
          itemId: options.itemId,
          timestep,
          points: parsed.data,
        };
      },
      {
        retries: this.retries,
        onFailedAttempt: ({ error, attemptNumber }) => {
          console.warn(
            `Timeseries fetch attempt ${attemptNumber} failed:`,
            error.message
          );
        },
      }
    );

    if (this.cache) {
      await this.cache.set(cacheKey, result, this.cacheTtlMs);
    }

    return result;
  }

  private async getIntervalPrices(
    interval: '5m' | '1h',
    timestamp?: number
  ): Promise<PricesResponse<IntervalItemPrice>> {
    const primaryUrl = timestamp
      ? `${this.baseUrl}/prices/${interval}?timestamp=${timestamp}`
      : `${this.baseUrl}/prices/${interval}`;
    const fallbackUrl = timestamp
      ? `${this.baseUrl}/${interval}?timestamp=${timestamp}`
      : `${this.baseUrl}/${interval}`;
    const cacheKey = `prices:${interval}:${timestamp ?? 'latest'}`;

    if (this.cache) {
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return cached as PricesResponse<IntervalItemPrice>;
      }
    }

    const result = await pRetry(
      async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

        let response = await fetch(primaryUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent': this.userAgent,
            Accept: 'application/json',
          },
        }).finally(() => clearTimeout(timeoutId));

        if (response.status === 404) {
          const fallbackController = new AbortController();
          const fallbackTimeout = setTimeout(
            () => fallbackController.abort(),
            this.timeoutMs
          );
          response = await fetch(fallbackUrl, {
            signal: fallbackController.signal,
            headers: {
              'User-Agent': this.userAgent,
              Accept: 'application/json',
            },
          }).finally(() => clearTimeout(fallbackTimeout));
        }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const json = await response.json();
        const parsed = IntervalPricesSchema.parse(json);

        const prices = new Map<number, IntervalItemPrice>();
        if (Array.isArray(parsed.data)) {
          for (const entry of parsed.data) {
            const derivedVolume =
              (entry.highPriceVolume ?? 0) + (entry.lowPriceVolume ?? 0);
            const volume =
              entry.volume ?? (derivedVolume > 0 ? derivedVolume : null);
            prices.set(entry.id, {
              itemId: entry.id,
              avgHighPrice: entry.avgHighPrice,
              avgLowPrice: entry.avgLowPrice,
              volume,
              highPriceVolume: entry.highPriceVolume ?? null,
              lowPriceVolume: entry.lowPriceVolume ?? null,
              timestamp: entry.timestamp ?? null,
            });
          }
        } else {
          for (const [id, data] of Object.entries(parsed.data)) {
            const itemId = parseInt(id, 10);
            const derivedVolume =
              (data.highPriceVolume ?? 0) + (data.lowPriceVolume ?? 0);
            const volume =
              data.volume ?? (derivedVolume > 0 ? derivedVolume : null);
            prices.set(itemId, {
              itemId,
              avgHighPrice: data.avgHighPrice,
              avgLowPrice: data.avgLowPrice,
              volume,
              highPriceVolume: data.highPriceVolume ?? null,
              lowPriceVolume: data.lowPriceVolume ?? null,
              timestamp: data.timestamp ?? null,
            });
          }
        }

        return {
          timestamp: new Date().toISOString(),
          prices,
        };
      },
      {
        retries: this.retries,
        onFailedAttempt: ({ error, attemptNumber }) => {
          console.warn(
            `${interval} price fetch attempt ${attemptNumber} failed:`,
            error.message
          );
        },
      }
    );

    if (this.cache) {
      await this.cache.set(cacheKey, result, this.cacheTtlMs);
    }

    return result;
  }
}

/**
 * Create a Wiki Prices API client
 */
export function createWikiPricesClient(
  userAgent: string,
  options?: {
    baseUrl?: string;
    retries?: number;
    timeoutMs?: number;
    cache?: CacheAdapter | null;
    cacheTtlMs?: number;
  }
): WikiPricesClient {
  return new WikiPricesClient({ userAgent, ...options });
}
