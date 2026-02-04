/**
 * GE Exchange Service
 *
 * Provides combined item data including mappings, prices, margins, and calculated fields
 * like ROI, potential profit, etc. for the GE Exchange interface.
 */

import { createWikiPricesClient } from '@skillbound/wiki-api';

import { getWikiCache, getWikiCacheTtlMs } from '../cache/wiki-cache';

/**
 * GE Tax rate (1% capped at 5m)
 */
const GE_TAX_RATE = 0.01;
const GE_TAX_CAP = 5_000_000;

/**
 * Calculate GE tax for a sale price
 */
export function calculateGeTax(sellPrice: number): number {
  const tax = Math.floor(sellPrice * GE_TAX_RATE);
  return Math.min(tax, GE_TAX_CAP);
}

/**
 * Combined item data with prices and calculated fields
 */
export interface GeExchangeItem {
  id: number;
  name: string;
  examine: string;
  members: boolean;
  icon: string;
  buyLimit: number | null;
  lowAlch: number | null;
  highAlch: number | null;
  value: number;

  // Live prices
  buyPrice: number | null; // instant buy price (high)
  sellPrice: number | null; // instant sell price (low)
  buyPriceTime: Date | null;
  sellPriceTime: Date | null;

  // Calculated fields
  margin: number | null;
  tax: number | null;
  profit: number | null; // margin - tax
  roiPercent: number | null;
  potentialProfit: number | null; // profit * buyLimit

  // Volume data (from 5m or 1h prices)
  volume: number | null;
  avgHighPrice: number | null;
  avgLowPrice: number | null;
  volume5m: number | null;
  volume1h: number | null;
  avgHighPrice5m: number | null;
  avgLowPrice5m: number | null;
  avgHighPrice1h: number | null;
  avgLowPrice1h: number | null;
}

export interface GeItemFilters {
  search?: string | undefined;
  members?: boolean | undefined;
  minProfit?: number | undefined;
  maxProfit?: number | undefined;
  minVolume?: number | undefined;
  maxVolume?: number | undefined;
  minRoi?: number | undefined;
  maxRoi?: number | undefined;
  minMargin?: number | undefined;
  maxMargin?: number | undefined;
  minPrice?: number | undefined;
  maxPrice?: number | undefined;
  minSellPrice?: number | undefined;
  maxSellPrice?: number | undefined;
  minPotentialProfit?: number | undefined;
  maxPotentialProfit?: number | undefined;
}

/**
 * Item search result for autocomplete
 */
export interface ItemSearchResult {
  id: number;
  name: string;
  icon: string;
  members: boolean;
  buyLimit: number | null;
  buyPrice: number | null;
  sellPrice: number | null;
}

/**
 * Timeseries point for charts
 */
export interface PricePoint {
  timestamp: Date;
  buyPrice: number | null;
  sellPrice: number | null;
  volume: number | null;
}

/**
 * Time period options for charts
 */
export type ChartPeriod = 'live' | '1w' | '1m' | '1y' | '5y' | 'all';

type WikiClientKind = 'latest' | 'interval' | 'mapping' | 'timeseries';

/**
 * Create a wiki prices client with caching tuned to the data type.
 */
function getWikiClient(kind: WikiClientKind) {
  const cache = getWikiCache();
  const cacheTtlMs = getWikiCacheTtlMs(kind);
  const userAgent =
    process.env['SKILLBOUND_USER_AGENT'] ??
    process.env['INTEGRATIONS_USER_AGENT'] ??
    'Skillbound';
  const baseUrl = process.env['WIKI_PRICES_BASE_URL'];

  return createWikiPricesClient(userAgent, {
    cache,
    cacheTtlMs,
    ...(baseUrl ? { baseUrl } : {}),
  });
}

/**
 * Get all GE items with current prices and calculations
 */
export async function getGeExchangeItems(): Promise<GeExchangeItem[]> {
  const mappingClient = getWikiClient('mapping');
  const latestClient = getWikiClient('latest');
  const intervalClient = getWikiClient('interval');

  const [mappings, latestPrices, intervalPrices, hourlyPrices] = await Promise.all([
    mappingClient.getItemMappings(),
    latestClient.getLatestPrices(),
    intervalClient.get5MinutePrices(),
    intervalClient.get1HourPrices(),
  ]);

  const items: GeExchangeItem[] = [];

  for (const mapping of mappings) {
    const latest = latestPrices.prices.get(mapping.id);
    const interval = intervalPrices.prices.get(mapping.id);
    const hourlyInterval = hourlyPrices.prices.get(mapping.id);

    const buyPrice = latest?.high ?? null;
    const sellPrice = latest?.low ?? null;

    // Calculate margin (sell-to-buyers minus buy-now)
    const margin =
      buyPrice !== null && sellPrice !== null ? buyPrice - sellPrice : null;

    // GE tax applies to the sale price (buy price)
    const tax = buyPrice !== null ? calculateGeTax(buyPrice) : null;

    // Profit is margin minus tax
    const profit =
      margin !== null && tax !== null ? margin - tax : null;

    // ROI percentage (profit / buy-now price (sell price) * 100)
    const roiPercent =
      profit !== null && sellPrice !== null && sellPrice > 0
        ? (profit / sellPrice) * 100
        : null;

    // Potential profit based on buy limit
    const buyLimit = mapping.limit ?? null;
    const potentialProfit =
      profit !== null && buyLimit !== null
        ? profit * buyLimit
        : null;

    const volume5m = interval?.volume ?? null;
    const volume1h = hourlyInterval?.volume ?? null;
    const avgHighPrice5m = interval?.avgHighPrice ?? null;
    const avgLowPrice5m = interval?.avgLowPrice ?? null;
    const avgHighPrice1h = hourlyInterval?.avgHighPrice ?? null;
    const avgLowPrice1h = hourlyInterval?.avgLowPrice ?? null;

    items.push({
      id: mapping.id,
      name: mapping.name,
      examine: mapping.examine,
      members: mapping.members,
      icon: mapping.icon,
      buyLimit,
      lowAlch: mapping.lowalch ?? null,
      highAlch: mapping.highalch ?? null,
      value: mapping.value ?? 0,

      buyPrice,
      sellPrice,
      buyPriceTime: latest?.highTime
        ? new Date(latest.highTime * 1000)
        : null,
      sellPriceTime: latest?.lowTime
        ? new Date(latest.lowTime * 1000)
        : null,

      margin,
      tax,
      profit,
      roiPercent,
      potentialProfit,

      volume: volume5m ?? volume1h ?? null,
      avgHighPrice: avgHighPrice5m ?? avgHighPrice1h ?? null,
      avgLowPrice: avgLowPrice5m ?? avgLowPrice1h ?? null,
      volume5m,
      volume1h,
      avgHighPrice5m,
      avgLowPrice5m,
      avgHighPrice1h,
      avgLowPrice1h,
    });
  }

  return items;
}

export function filterGeItems(
  items: GeExchangeItem[],
  filters: GeItemFilters
): GeExchangeItem[] {
  let result = items;
  const {
    search,
    members,
    minProfit,
    maxProfit,
    minVolume,
    maxVolume,
    minRoi,
    maxRoi,
    minMargin,
    maxMargin,
    minPrice,
    maxPrice,
    minSellPrice,
    maxSellPrice,
    minPotentialProfit,
    maxPotentialProfit,
  } = filters;

  if (search) {
    const searchLower = search.toLowerCase();
    result = result.filter((item) =>
      item.name.toLowerCase().includes(searchLower)
    );
  }

  if (members !== undefined) {
    result = result.filter((item) => item.members === members);
  }

  if (minProfit !== undefined) {
    result = result.filter(
      (item) => item.profit !== null && item.profit >= minProfit
    );
  }

  if (maxProfit !== undefined) {
    result = result.filter(
      (item) => item.profit !== null && item.profit <= maxProfit
    );
  }

  if (minVolume !== undefined) {
    result = result.filter(
      (item) => item.volume !== null && item.volume >= minVolume
    );
  }

  if (maxVolume !== undefined) {
    result = result.filter(
      (item) => item.volume !== null && item.volume <= maxVolume
    );
  }

  if (minRoi !== undefined) {
    result = result.filter(
      (item) => item.roiPercent !== null && item.roiPercent >= minRoi
    );
  }

  if (maxRoi !== undefined) {
    result = result.filter(
      (item) => item.roiPercent !== null && item.roiPercent <= maxRoi
    );
  }

  if (minMargin !== undefined) {
    result = result.filter(
      (item) => item.margin !== null && item.margin >= minMargin
    );
  }

  if (maxMargin !== undefined) {
    result = result.filter(
      (item) => item.margin !== null && item.margin <= maxMargin
    );
  }

  if (minPrice !== undefined) {
    result = result.filter(
      (item) => item.buyPrice !== null && item.buyPrice >= minPrice
    );
  }

  if (maxPrice !== undefined) {
    result = result.filter(
      (item) => item.buyPrice !== null && item.buyPrice <= maxPrice
    );
  }

  if (minSellPrice !== undefined) {
    result = result.filter(
      (item) => item.sellPrice !== null && item.sellPrice >= minSellPrice
    );
  }

  if (maxSellPrice !== undefined) {
    result = result.filter(
      (item) => item.sellPrice !== null && item.sellPrice <= maxSellPrice
    );
  }

  if (minPotentialProfit !== undefined) {
    result = result.filter(
      (item) =>
        item.potentialProfit !== null &&
        item.potentialProfit >= minPotentialProfit
    );
  }

  if (maxPotentialProfit !== undefined) {
    result = result.filter(
      (item) =>
        item.potentialProfit !== null &&
        item.potentialProfit <= maxPotentialProfit
    );
  }

  return result;
}

/**
 * Get a single item by ID with full details
 */
export async function getGeItem(itemId: number): Promise<GeExchangeItem | null> {
  const items = await getGeExchangeItems();
  return items.find((item) => item.id === itemId) ?? null;
}

/**
 * Search items by name (for autocomplete)
 */
export async function searchItems(
  query: string,
  limit: number = 10
): Promise<ItemSearchResult[]> {
  if (!query || query.length < 1) {
    return [];
  }

  const mappingClient = getWikiClient('mapping');
  const latestClient = getWikiClient('latest');
  const [mappings, latestPrices] = await Promise.all([
    mappingClient.getItemMappings(),
    latestClient.getLatestPrices(),
  ]);

  const normalizedQuery = query.toLowerCase();

  // Filter and score items
  const matches = mappings
    .filter((item) => item.name.toLowerCase().includes(normalizedQuery))
    .map((item) => {
      const latest = latestPrices.prices.get(item.id);
      // Score: exact match = 3, starts with = 2, contains = 1
      let score = 1;
      const lowerName = item.name.toLowerCase();
      if (lowerName === normalizedQuery) {
        score = 3;
      } else if (lowerName.startsWith(normalizedQuery)) {
        score = 2;
      }
      return {
        item,
        latest,
        score,
      };
    })
    .sort((a, b) => {
      // Sort by score first, then alphabetically
      if (b.score !== a.score) return b.score - a.score;
      return a.item.name.localeCompare(b.item.name);
    })
    .slice(0, limit);

  return matches.map(({ item, latest }) => ({
    id: item.id,
    name: item.name,
    icon: item.icon,
    members: item.members,
    buyLimit: item.limit ?? null,
    buyPrice: latest?.high ?? null,
    sellPrice: latest?.low ?? null,
  }));
}

/**
 * Get timeseries data for an item (for charts)
 *
 * Note: The Wiki API timeseries endpoint does NOT support start/end parameters.
 * It returns up to 365 data points based on the timestep interval.
 * We filter the data client-side to match the requested period.
 */
export async function getItemTimeseries(
  itemId: number,
  period: ChartPeriod = 'live'
): Promise<PricePoint[]> {
  const client = getWikiClient('timeseries');

  // Determine timestep based on period
  // The API returns up to 365 data points, so we choose the timestep that gives
  // us appropriate granularity for the period:
  // - 5m: 365 points = ~30 hours (good for "live" 24h view)
  // - 1h: 365 points = ~15 days (good for 1w view)
  // - 6h: 365 points = ~91 days (good for 1m view)
  // - 24h: 365 points = ~1 year (good for 1y/5y/all views)
  let timestep: '5m' | '1h' | '6h' | '24h' = '5m';
  let filterStartTime: number | undefined;
  const now = Math.floor(Date.now() / 1000);

  switch (period) {
    case 'live':
      // Last 24 hours, 5m intervals
      timestep = '5m';
      filterStartTime = now - 24 * 60 * 60;
      break;
    case '1w':
      // Last week, 1h intervals
      timestep = '1h';
      filterStartTime = now - 7 * 24 * 60 * 60;
      break;
    case '1m':
      // Last month, 6h intervals
      timestep = '6h';
      filterStartTime = now - 30 * 24 * 60 * 60;
      break;
    case '1y':
      // Last year, 24h intervals
      timestep = '24h';
      filterStartTime = now - 365 * 24 * 60 * 60;
      break;
    case '5y':
      // Last 5 years, 24h intervals (API only has ~1 year max)
      timestep = '24h';
      filterStartTime = now - 5 * 365 * 24 * 60 * 60;
      break;
    case 'all':
      // All time, 24h intervals - no filtering
      timestep = '24h';
      filterStartTime = undefined;
      break;
  }

  // Note: We don't send start/end params as the Wiki API doesn't support them
  const timeseries = await client.getTimeseries({ itemId, timestep });

  let points = timeseries.points.map((point) => ({
    timestamp: new Date(point.timestamp * 1000),
    buyPrice: point.avgHighPrice,
    sellPrice: point.avgLowPrice,
    volume:
      (point.highPriceVolume ?? 0) + (point.lowPriceVolume ?? 0) ||
      point.volume ||
      null,
  }));

  // Filter points client-side to match the requested time period
  // (API returns all available data up to 365 points, we filter to the requested range)
  if (filterStartTime !== undefined) {
    const startDate = new Date(filterStartTime * 1000);
    points = points.filter((point) => point.timestamp >= startDate);
  }

  const hasVolume = points.some((point) => (point.volume ?? 0) > 0);
  if (!hasVolume) {
    const fallbackInterval =
      timestep === '5m' ? await client.get5MinutePrices() : await client.get1HourPrices();
    const fallbackVolume = fallbackInterval.prices.get(itemId)?.volume ?? null;
    if (fallbackVolume && fallbackVolume > 0) {
      points = points.map((point) => ({
        ...point,
        volume: fallbackVolume,
      }));
    }
  }

  return points;
}

/**
 * Get item icon URL from wiki using icon filename
 */
export function getItemIconUrl(iconName: string): string {
  // Wiki icons are served from the wiki's static files
  // The icon name from the API is already encoded properly
  const encodedName = encodeURIComponent(iconName.replace(/ /g, '_'));
  return `https://oldschool.runescape.wiki/images/${encodedName}`;
}

// Cache for item mappings to avoid repeated API calls
let itemMappingsCache: Map<number, { name: string; icon: string }> | null = null;
let itemMappingsCacheTime = 0;
const ITEM_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get item mapping by ID (cached)
 */
export async function getItemMapping(
  itemId: number
): Promise<{ name: string; icon: string } | null> {
  const now = Date.now();

  // Refresh cache if expired or empty
  if (!itemMappingsCache || now - itemMappingsCacheTime > ITEM_CACHE_TTL_MS) {
    try {
      const client = getWikiClient('mapping');
      const mappings = await client.getItemMappings();
      itemMappingsCache = new Map();
      for (const item of mappings) {
        itemMappingsCache.set(item.id, { name: item.name, icon: item.icon });
      }
      itemMappingsCacheTime = now;
    } catch {
      // If fetch fails and we have stale cache, use it
      if (!itemMappingsCache) {
        return null;
      }
    }
  }

  return itemMappingsCache.get(itemId) ?? null;
}

/**
 * Get item icon URL by item ID
 * Falls back to a placeholder if item not found
 */
export async function getItemIconById(itemId: number): Promise<string> {
  const mapping = await getItemMapping(itemId);
  if (mapping) {
    return getItemIconUrl(mapping.icon);
  }
  // Return a transparent placeholder
  return 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
}

/**
 * Format GP value for display (e.g., 1.5m, 500k)
 */
export function formatGp(value: number | null): string {
  if (value === null) return '-';

  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (absValue >= 1_000_000_000) {
    return `${sign}${(absValue / 1_000_000_000).toFixed(2)}b`;
  }
  if (absValue >= 1_000_000) {
    return `${sign}${(absValue / 1_000_000).toFixed(2)}m`;
  }
  if (absValue >= 1_000) {
    return `${sign}${(absValue / 1_000).toFixed(1)}k`;
  }
  return value.toLocaleString();
}

/**
 * Parse GP input from user (supports k, m, b suffixes and commas)
 * Examples: "4m" -> 4000000, "1.5k" -> 1500, "2,500" -> 2500, "100" -> 100
 * Returns null if invalid
 */
export function parseGp(input: string): number | null {
  if (!input || typeof input !== 'string') return null;

  // Clean the input: remove commas, spaces, and convert to lowercase
  const cleaned = input.replace(/,/g, '').replace(/\s/g, '').toLowerCase().trim();

  if (!cleaned) return null;

  // Check for suffix multipliers
  const suffixMatch = cleaned.match(/^(-?)(\d+(?:\.\d+)?)(k|m|b)?$/);
  if (!suffixMatch) {
    // Try to parse as plain number
    const plainNum = parseFloat(cleaned);
    return isNaN(plainNum) || plainNum < 0 ? null : Math.round(plainNum);
  }

  const [, sign, numStr, suffix] = suffixMatch;
  const num = parseFloat(numStr ?? '0');

  if (isNaN(num)) return null;

  let multiplier = 1;
  if (suffix === 'k') multiplier = 1_000;
  else if (suffix === 'm') multiplier = 1_000_000;
  else if (suffix === 'b') multiplier = 1_000_000_000;

  const result = num * multiplier;
  return sign === '-' ? null : Math.round(result); // No negative values for GP
}

/**
 * Format time ago (e.g., "5 minutes ago", "2 hours ago")
 */
export function formatTimeAgo(date: Date | null, now: Date = new Date()): string {
  if (!date) return 'Unknown';

  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
}

/**
 * Format ROI percentage
 */
export function formatRoi(roiPercent: number | null): string {
  if (roiPercent === null) return '-';
  const sign = roiPercent >= 0 ? '+' : '';
  return `${sign}${roiPercent.toFixed(2)}%`;
}

/**
 * Sort options for the exchange table
 */
export type SortField =
  | 'name'
  | 'buyPrice'
  | 'sellPrice'
  | 'margin'
  | 'tax'
  | 'profit'
  | 'roiPercent'
  | 'volume'
  | 'buyLimit'
  | 'potentialProfit'
  | 'lastTrade';

export type SortDirection = 'asc' | 'desc';

type SortSpec = { field: SortField; direction: SortDirection };

/**
 * Sort items by a field
 */
export function sortItems(
  items: GeExchangeItem[],
  field: SortField,
  direction: SortDirection
): GeExchangeItem[] {
  return sortItemsMulti(items, [{ field, direction }]);
}

function getSortValue(
  item: GeExchangeItem,
  field: SortField
): number | string | Date | null {
  switch (field) {
    case 'name':
      return item.name;
    case 'buyPrice':
      return item.buyPrice;
    case 'sellPrice':
      return item.sellPrice;
    case 'margin':
      return item.margin;
    case 'tax':
      return item.tax;
    case 'profit':
      return item.profit;
    case 'roiPercent':
      return item.roiPercent;
    case 'volume':
      return item.volume;
    case 'buyLimit':
      return item.buyLimit;
    case 'potentialProfit':
      return item.potentialProfit;
    case 'lastTrade':
      if (item.buyPriceTime && item.sellPriceTime) {
        return item.buyPriceTime > item.sellPriceTime
          ? item.buyPriceTime
          : item.sellPriceTime;
      }
      return item.buyPriceTime ?? item.sellPriceTime ?? null;
  }
}

export function sortItemsMulti(
  items: GeExchangeItem[],
  sorts: SortSpec[]
): GeExchangeItem[] {
  const normalized: SortSpec[] =
    sorts.length > 0 ? sorts : [{ field: 'profit', direction: 'desc' }];
  const sorted = [...items].sort((a, b) => {
    for (const sort of normalized) {
      const aValue = getSortValue(a, sort.field);
      const bValue = getSortValue(b, sort.field);

      if (aValue === null && bValue === null) continue;
      if (aValue === null) return 1;
      if (bValue === null) return -1;

      let comparison: number;
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        comparison = aValue.localeCompare(bValue);
      } else if (aValue instanceof Date && bValue instanceof Date) {
        comparison = aValue.getTime() - bValue.getTime();
      } else {
        comparison = (aValue as number) - (bValue as number);
      }

      if (comparison !== 0) {
        return sort.direction === 'asc' ? comparison : -comparison;
      }
    }

    return 0;
  });

  return sorted;
}

/**
 * Filter items by favorites (item IDs)
 */
export function filterByFavorites(
  items: GeExchangeItem[],
  favoriteIds: Set<number>
): GeExchangeItem[] {
  return items.filter((item) => favoriteIds.has(item.id));
}
