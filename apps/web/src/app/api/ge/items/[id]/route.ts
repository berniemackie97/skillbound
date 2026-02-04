import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getGeItem, getItemTimeseries, type ChartPeriod } from '@/lib/trading/ge-service';
import { createProblemDetails } from '@/lib/api/problem-details';
import { checkRateLimit, getClientIp } from '@/lib/api/rate-limit';

const paramsSchema = z.object({
  id: z.string().transform((v) => parseInt(v, 10)),
});

type RouteParams = Promise<{ id?: string }>;

const querySchema = z.object({
  period: z
    .string()
    .optional()
    .transform((v) => {
      const periods: ChartPeriod[] = ['live', '1w', '1m', '1y', '5y', 'all'];
      return periods.includes(v as ChartPeriod) ? (v as ChartPeriod) : 'live';
    }),
  includeTimeseries: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
});

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
 * GET /api/ge/items/[id]
 *
 * Get a single GE item with full details and optionally timeseries data.
 *
 * Query params:
 * - period: Timeseries period (live/1w/1m/1y/5y/all, default: live)
 * - includeTimeseries: Include timeseries data (default: false)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: RouteParams }
) {
  const resolvedParams = await params;
  const parsedParams = paramsSchema.safeParse(resolvedParams);
  if (!parsedParams.success || !Number.isFinite(parsedParams.data.id)) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid request',
      detail: 'Invalid item ID.',
      errors: parsedParams.success ? undefined : parsedParams.error.issues,
      instance: request.nextUrl.pathname,
    });
    return NextResponse.json(problem, { status: problem.status });
  }

  const parsedQuery = querySchema.safeParse({
    period: request.nextUrl.searchParams.get('period') ?? undefined,
    includeTimeseries:
      request.nextUrl.searchParams.get('includeTimeseries') ?? undefined,
  });

  if (!parsedQuery.success) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid request',
      detail: 'Invalid query parameters.',
      errors: parsedQuery.error.issues,
      instance: request.nextUrl.pathname,
    });
    return NextResponse.json(problem, { status: problem.status });
  }

  const rateLimitId = `ge:item:${getClientIp(request)}`;
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
    const itemId = parsedParams.data.id;
    const item = await getGeItem(itemId);

    if (!item) {
      const problem = createProblemDetails({
        status: 404,
        title: 'Item not found',
        detail: `No item found with ID ${itemId}.`,
        instance: request.nextUrl.pathname,
      });
      return applyRateLimitHeaders(
        NextResponse.json(problem, { status: problem.status }),
        rateLimitResult
      );
    }

    // Serialize dates
    const serializedItem = {
      ...item,
      buyPriceTime: item.buyPriceTime?.toISOString() ?? null,
      sellPriceTime: item.sellPriceTime?.toISOString() ?? null,
    };

    // Optionally fetch timeseries
    let timeseries = null;
    if (parsedQuery.data.includeTimeseries) {
      const points = await getItemTimeseries(itemId, parsedQuery.data.period);
      timeseries = {
        period: parsedQuery.data.period,
        points: points.map((p) => ({
          timestamp: p.timestamp.toISOString(),
          buyPrice: p.buyPrice,
          sellPrice: p.sellPrice,
          volume: p.volume,
        })),
      };
    }

    const response = NextResponse.json({
      data: {
        ...serializedItem,
        timeseries,
      },
    });

    return applyRateLimitHeaders(response, rateLimitResult);
  } catch (error) {
    console.error('GE item error:', error);
    const problem = createProblemDetails({
      status: 502,
      title: 'Upstream error',
      detail: 'Failed to fetch item data.',
      instance: request.nextUrl.pathname,
    });

    return applyRateLimitHeaders(
      NextResponse.json(problem, { status: problem.status }),
      rateLimitResult
    );
  }
}
