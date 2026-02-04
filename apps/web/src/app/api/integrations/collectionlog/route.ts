import {
  CollectionLogNotFoundError,
  CollectionLogRateLimitError,
  CollectionLogServerError,
  createCollectionLogClient,
} from '@skillbound/integrations/collectionlog';
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
  username: z
    .string()
    .trim()
    .min(1)
    .max(12)
    .regex(/^[A-Za-z0-9 _-]+$/),
  refresh: z
    .string()
    .optional()
    .transform((value) => value === 'true' || value === '1'),
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

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const parsed = querySchema.safeParse({
    username: searchParams.get('username') ?? '',
    refresh: searchParams.get('refresh') ?? undefined,
  });

  if (!parsed.success) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid request',
      detail: 'Invalid username or refresh flag.',
      errors: parsed.error.issues,
      instance: request.nextUrl.pathname,
    });

    return NextResponse.json(problem, { status: problem.status });
  }

  const rateLimitId = `collectionlog:${getClientIp(request)}`;
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
  const cacheTtlMs = getIntegrationsCacheTtlMs('collectionlog');
  const cacheKey = `integrations:collectionlog:${parsed.data.username.toLowerCase()}`;

  try {
    let cached = false;
    let data = null;

    if (!parsed.data.refresh && cache) {
      const cachedValue = await cache.get(cacheKey);
      if (cachedValue) {
        cached = true;
        data = cachedValue;
      }
    }

    const userAgent =
      process.env['SKILLBOUND_USER_AGENT'] ??
      process.env['INTEGRATIONS_USER_AGENT'];
    const client = createCollectionLogClient({
      cache: null,
      ...(process.env['COLLECTIONLOG_BASE_URL']
        ? { baseUrl: process.env['COLLECTIONLOG_BASE_URL'] }
        : {}),
      ...(userAgent ? { userAgent } : {}),
    });

    if (!data) {
      data = await client.getUserCollectionLog(parsed.data.username);
      if (cache) {
        await cache.set(cacheKey, data, cacheTtlMs);
      }
    }

    const response = NextResponse.json({
      data,
      meta: { cached, refreshed: parsed.data.refresh },
    });
    return applyRateLimitHeaders(response, rateLimitResult);
  } catch (error) {
    if (error instanceof CollectionLogNotFoundError) {
      const problem = createProblemDetails({
        status: 404,
        title: 'Collection log not found',
        detail: 'No collection log entry found for the supplied username.',
        instance: request.nextUrl.pathname,
      });

      return applyRateLimitHeaders(
        NextResponse.json(problem, { status: problem.status }),
        rateLimitResult
      );
    }

    if (error instanceof CollectionLogRateLimitError) {
      const problem = createProblemDetails({
        status: 429,
        title: 'Upstream rate limit',
        detail: 'Collection log API is rate limiting requests. Try again soon.',
        instance: request.nextUrl.pathname,
      });

      return applyRateLimitHeaders(
        NextResponse.json(problem, { status: problem.status }),
        rateLimitResult
      );
    }

    if (error instanceof CollectionLogServerError) {
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

    console.error('Collection log lookup error:', error);
    const problem = createProblemDetails({
      status: 500,
      title: 'Internal server error',
      detail: 'Unexpected error while processing collection log lookup.',
      instance: request.nextUrl.pathname,
    });

    return applyRateLimitHeaders(
      NextResponse.json(problem, { status: problem.status }),
      rateLimitResult
    );
  }
}
