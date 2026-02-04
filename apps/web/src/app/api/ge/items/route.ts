import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  filterGeItems,
  getGeExchangeItems,
  sortItemsMulti,
  type GeItemFilters,
  type SortDirection,
  type SortField,
} from '@/lib/trading/ge-service';
import { createProblemDetails } from '@/lib/api/problem-details';
import { checkRateLimit, getClientIp } from '@/lib/api/rate-limit';

export const dynamic = 'force-dynamic';

const sortFields: SortField[] = [
  'name',
  'buyPrice',
  'sellPrice',
  'margin',
  'tax',
  'profit',
  'roiPercent',
  'volume',
  'buyLimit',
  'potentialProfit',
  'lastTrade',
];

const querySchema = z.object({
  ids: z
    .string()
    .optional()
    .transform((v) => parseIds(v)),
  sort: z.string().optional(),
  order: z.string().optional(),
  page: z
    .string()
    .optional()
    .transform((v) => Math.max(1, parseInt(v ?? '1', 10) || 1)),
  limit: z
    .string()
    .optional()
    .transform((v) => Math.min(Math.max(1, parseInt(v ?? '25', 10) || 25), 100)),
  search: z.string().optional(),
  members: z
    .string()
    .optional()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
  minProfit: z
    .string()
    .optional()
    .transform((v) => parseOptionalInt(v)),
  maxProfit: z
    .string()
    .optional()
    .transform((v) => parseOptionalInt(v)),
  minVolume: z
    .string()
    .optional()
    .transform((v) => parseOptionalInt(v)),
  maxVolume: z
    .string()
    .optional()
    .transform((v) => parseOptionalInt(v)),
  minRoi: z
    .string()
    .optional()
    .transform((v) => parseOptionalFloat(v)),
  maxRoi: z
    .string()
    .optional()
    .transform((v) => parseOptionalFloat(v)),
  minMargin: z
    .string()
    .optional()
    .transform((v) => parseOptionalInt(v)),
  maxMargin: z
    .string()
    .optional()
    .transform((v) => parseOptionalInt(v)),
  minPrice: z
    .string()
    .optional()
    .transform((v) => parseOptionalInt(v)),
  maxPrice: z
    .string()
    .optional()
    .transform((v) => parseOptionalInt(v)),
  minSellPrice: z
    .string()
    .optional()
    .transform((v) => parseOptionalInt(v)),
  maxSellPrice: z
    .string()
    .optional()
    .transform((v) => parseOptionalInt(v)),
  minPotentialProfit: z
    .string()
    .optional()
    .transform((v) => parseOptionalInt(v)),
  maxPotentialProfit: z
    .string()
    .optional()
    .transform((v) => parseOptionalInt(v)),
});

function parseIds(value?: string): number[] | undefined {
  if (!value) return undefined;
  const ids = value
    .split(',')
    .map((entry) => Number.parseInt(entry.trim(), 10))
    .filter((id) => Number.isFinite(id) && id > 0);
  if (ids.length === 0) return undefined;
  return Array.from(new Set(ids));
}

function parseSortList(value?: string): SortField[] {
  const candidates = (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  const valid = candidates.filter((entry) => sortFields.includes(entry as SortField));
  return valid.length > 0 ? (valid as SortField[]) : ['profit'];
}

function parseOrderList(value: string | undefined, length: number): SortDirection[] {
  const candidates = (value ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  const orders = Array.from({ length }, (_, index) => {
    const entry = candidates[index];
    return entry === 'asc' ? 'asc' : 'desc';
  });
  return orders;
}

function parseOptionalInt(value?: string): number | undefined {
  if (value === undefined || value === '') return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseOptionalFloat(value?: string): number | undefined {
  if (value === undefined || value === '') return undefined;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function applyRateLimitHeaders(
  response: NextResponse,
  rateLimitResult: Awaited<ReturnType<typeof checkRateLimit>>
) {
  response.headers.set('RateLimit-Limit', String(rateLimitResult.limit));
  response.headers.set(
    'RateLimit-Remaining',
    String(rateLimitResult.remaining)
  );
  response.headers.set('RateLimit-Reset', String(rateLimitResult.reset));
  return response;
}

/**
 * GET /api/ge/items
 *
 * Get all GE items with prices and calculated fields.
 * Supports sorting, pagination, and filtering.
 *
 * Query params:
 * - sort: Field to sort by (default: profit)
 * - order: Sort direction (asc/desc, default: desc)
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 25, max: 100)
 * - search: Filter by name
 * - members: Filter by members only (true/false)
 * - minProfit: Minimum profit filter
 * - maxProfit: Maximum profit filter
 * - minVolume: Minimum volume filter
 * - maxVolume: Maximum volume filter
 * - minRoi: Minimum ROI percentage
 * - maxRoi: Maximum ROI percentage
 * - minMargin: Minimum margin filter
 * - maxMargin: Maximum margin filter
 * - minPrice: Minimum buy price filter
 * - maxPrice: Maximum buy price filter
 * - minSellPrice: Minimum sell price filter
 * - maxSellPrice: Maximum sell price filter
 * - minPotentialProfit: Minimum potential profit filter
 * - maxPotentialProfit: Maximum potential profit filter
 */
export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse({
    ids: request.nextUrl.searchParams.get('ids') ?? undefined,
    sort: request.nextUrl.searchParams.get('sort') ?? undefined,
    order: request.nextUrl.searchParams.get('order') ?? undefined,
    page: request.nextUrl.searchParams.get('page') ?? undefined,
    limit: request.nextUrl.searchParams.get('limit') ?? undefined,
    search: request.nextUrl.searchParams.get('search') ?? undefined,
    members: request.nextUrl.searchParams.get('members') ?? undefined,
    minProfit: request.nextUrl.searchParams.get('minProfit') ?? undefined,
    maxProfit: request.nextUrl.searchParams.get('maxProfit') ?? undefined,
    minVolume: request.nextUrl.searchParams.get('minVolume') ?? undefined,
    maxVolume: request.nextUrl.searchParams.get('maxVolume') ?? undefined,
    minRoi: request.nextUrl.searchParams.get('minRoi') ?? undefined,
    maxRoi: request.nextUrl.searchParams.get('maxRoi') ?? undefined,
    minMargin: request.nextUrl.searchParams.get('minMargin') ?? undefined,
    maxMargin: request.nextUrl.searchParams.get('maxMargin') ?? undefined,
    minPrice: request.nextUrl.searchParams.get('minPrice') ?? undefined,
    maxPrice: request.nextUrl.searchParams.get('maxPrice') ?? undefined,
    minSellPrice: request.nextUrl.searchParams.get('minSellPrice') ?? undefined,
    maxSellPrice: request.nextUrl.searchParams.get('maxSellPrice') ?? undefined,
    minPotentialProfit:
      request.nextUrl.searchParams.get('minPotentialProfit') ?? undefined,
    maxPotentialProfit:
      request.nextUrl.searchParams.get('maxPotentialProfit') ?? undefined,
  });

  if (!parsed.success) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid request',
      detail: 'Invalid query parameters.',
      errors: parsed.error.issues,
      instance: request.nextUrl.pathname,
    });
    return NextResponse.json(problem, { status: problem.status });
  }

  const rateLimitId = `ge:items:${getClientIp(request)}`;
  const rateLimitResult = await checkRateLimit(rateLimitId);
  if (!rateLimitResult.success) {
    const problem = createProblemDetails({
      status: 429,
      title: 'Rate limit exceeded',
      detail: 'Too many requests. Please try again later.',
      instance: request.nextUrl.pathname,
    });

    return applyRateLimitHeaders(
      NextResponse.json(problem, { status: problem.status }),
      rateLimitResult
    );
  }

  try {
    let items = await getGeExchangeItems();

    if (parsed.data.ids && parsed.data.ids.length > 0) {
      const itemMap = new Map(items.map((item) => [item.id, item]));
      const filtered = parsed.data.ids
        .map((id) => itemMap.get(id))
        .filter((item): item is (typeof items)[number] => Boolean(item));

      const serializedItems = filtered.map((item) => ({
        ...item,
        buyPriceTime: item.buyPriceTime?.toISOString() ?? null,
        sellPriceTime: item.sellPriceTime?.toISOString() ?? null,
      }));

      const response = NextResponse.json({
        data: serializedItems,
        meta: {
          total: serializedItems.length,
          page: 1,
          limit: serializedItems.length,
          totalPages: 1,
        },
      });

      return applyRateLimitHeaders(response, rateLimitResult);
    }

    const filters: GeItemFilters = {
      search: parsed.data.search,
      members: parsed.data.members,
      minProfit: parsed.data.minProfit,
      maxProfit: parsed.data.maxProfit,
      minVolume: parsed.data.minVolume,
      maxVolume: parsed.data.maxVolume,
      minRoi: parsed.data.minRoi,
      maxRoi: parsed.data.maxRoi,
      minMargin: parsed.data.minMargin,
      maxMargin: parsed.data.maxMargin,
      minPrice: parsed.data.minPrice,
      maxPrice: parsed.data.maxPrice,
      minSellPrice: parsed.data.minSellPrice,
      maxSellPrice: parsed.data.maxSellPrice,
      minPotentialProfit: parsed.data.minPotentialProfit,
      maxPotentialProfit: parsed.data.maxPotentialProfit,
    };

    items = filterGeItems(items, filters);

    // Apply sorting
    const sortList = parseSortList(parsed.data.sort);
    const orderList = parseOrderList(parsed.data.order, sortList.length);
    const sorts = sortList.map((field, index) => ({
      field,
      direction: orderList[index] ?? 'desc',
    }));
    items = sortItemsMulti(items, sorts);

    // Calculate pagination
    const total = items.length;
    const offset = (parsed.data.page - 1) * parsed.data.limit;
    const paginatedItems = items.slice(offset, offset + parsed.data.limit);
    const totalPages = Math.ceil(total / parsed.data.limit);

    // Serialize dates to ISO strings for JSON
    const serializedItems = paginatedItems.map((item) => ({
      ...item,
      buyPriceTime: item.buyPriceTime?.toISOString() ?? null,
      sellPriceTime: item.sellPriceTime?.toISOString() ?? null,
    }));

    const response = NextResponse.json({
      data: serializedItems,
      meta: {
        total,
        page: parsed.data.page,
        limit: parsed.data.limit,
        totalPages,
        sort: sortList.join(','),
        order: orderList.join(','),
      },
    });

    return applyRateLimitHeaders(response, rateLimitResult);
  } catch (error) {
    console.error('GE items error:', error);
    const problem = createProblemDetails({
      status: 502,
      title: 'Upstream error',
      detail: 'Failed to fetch GE items.',
      instance: request.nextUrl.pathname,
    });

    return applyRateLimitHeaders(
      NextResponse.json(problem, { status: problem.status }),
      rateLimitResult
    );
  }
}
