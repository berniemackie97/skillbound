import {
  createOsrsBoxClient,
  OsrsBoxNotFoundError,
  OsrsBoxServerError,
} from '@skillbound/integrations/osrsbox';
import { ParseError } from '@skillbound/integrations/shared';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createProblemDetails } from '@/lib/api/problem-details';
import { checkRateLimit, getClientIp } from '@/lib/api/rate-limit';
import {
  getIntegrationsCache,
  getIntegrationsCacheTtlMs,
} from '@/lib/cache/integrations-cache';

const querySchema = z.object({
  ids: z.string().optional(),
  id: z.string().optional(),
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

function parseIds(raw: string | undefined): number[] | null {
  if (!raw) {
    return null;
  }

  const ids = raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => Number.parseInt(value, 10));

  if (ids.length === 0 || ids.some((value) => !Number.isFinite(value))) {
    return null;
  }

  return Array.from(new Set(ids));
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const parsed = querySchema.safeParse({
    ids: searchParams.get('ids') ?? undefined,
    id: searchParams.get('id') ?? undefined,
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

  const ids = parseIds(parsed.data.ids) ?? parseIds(parsed.data.id);
  if (!ids) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid ids',
      detail: 'Provide id or ids as a comma-separated list of numbers.',
      instance: request.nextUrl.pathname,
    });

    return NextResponse.json(problem, { status: problem.status });
  }

  const rateLimitId = `osrsbox:${getClientIp(request)}`;
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

  const cache = getIntegrationsCache();
  const cacheTtlMs = getIntegrationsCacheTtlMs('osrsbox');
  const userAgent =
    process.env['SKILLBOUND_USER_AGENT'] ??
    process.env['INTEGRATIONS_USER_AGENT'];
  const client = createOsrsBoxClient({
    cache: null,
    ...(process.env['OSRSBOX_BASE_URL']
      ? { baseUrl: process.env['OSRSBOX_BASE_URL'] }
      : {}),
    ...(userAgent ? { userAgent } : {}),
  });

  try {
    const cachedMap: Record<string, boolean> = {};
    const items = [];

    for (const id of ids) {
      const cacheKey = `integrations:osrsbox:item:${id}`;
      if (cache) {
        const cached = await cache.get(cacheKey);
        if (cached) {
          cachedMap[String(id)] = true;
          items.push(cached);
          continue;
        }
      }

      const item = await client.getItem(id);
      cachedMap[String(id)] = false;
      items.push(item);
      if (cache) {
        await cache.set(cacheKey, item, cacheTtlMs);
      }
    }

    const response = NextResponse.json({
      data: items,
      meta: { cached: cachedMap },
    });

    return applyRateLimitHeaders(response, rateLimitResult);
  } catch (error) {
    if (error instanceof OsrsBoxNotFoundError) {
      const problem = createProblemDetails({
        status: 404,
        title: 'Item not found',
        detail: `No OSRSBox item found for id ${error.id}.`,
        instance: request.nextUrl.pathname,
      });

      return applyRateLimitHeaders(
        NextResponse.json(problem, { status: problem.status }),
        rateLimitResult
      );
    }

    if (error instanceof OsrsBoxServerError) {
      const problem = createProblemDetails({
        status: 502,
        title: 'Upstream error',
        detail: error.message,
        instance: request.nextUrl.pathname,
      });

      return applyRateLimitHeaders(
        NextResponse.json(problem, { status: problem.status }),
        rateLimitResult
      );
    }

    if (error instanceof ParseError) {
      const problem = createProblemDetails({
        status: 502,
        title: 'Upstream response error',
        detail: error.message,
        instance: request.nextUrl.pathname,
      });

      return applyRateLimitHeaders(
        NextResponse.json(problem, { status: problem.status }),
        rateLimitResult
      );
    }

    console.error('OSRSBox item lookup error:', error);
    const problem = createProblemDetails({
      status: 500,
      title: 'Internal server error',
      detail: 'Unexpected error while processing OSRSBox lookup.',
      instance: request.nextUrl.pathname,
    });

    return applyRateLimitHeaders(
      NextResponse.json(problem, { status: problem.status }),
      rateLimitResult
    );
  }
}
