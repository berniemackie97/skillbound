import { ParseError } from '@skillbound/integrations/shared';
import {
  createWiseOldManClient,
  WiseOldManNotFoundError,
  WiseOldManRateLimitError,
  WiseOldManServerError,
} from '@skillbound/integrations/wise-old-man';
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

  const rateLimitId = `wise-old-man:${getClientIp(request)}`;
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
  const cacheTtlMs = getIntegrationsCacheTtlMs('wise-old-man');
  const cacheKey = `integrations:wise-old-man:${parsed.data.username.toLowerCase()}`;

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
    const client = createWiseOldManClient({
      cache: null,
      ...(process.env['WISE_OLD_MAN_BASE_URL']
        ? { baseUrl: process.env['WISE_OLD_MAN_BASE_URL'] }
        : {}),
      ...(userAgent ? { userAgent } : {}),
    });

    if (!data) {
      data = parsed.data.refresh
        ? await client.updatePlayer(parsed.data.username)
        : await client.getPlayer(parsed.data.username);

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
    if (error instanceof WiseOldManNotFoundError) {
      const problem = createProblemDetails({
        status: 404,
        title: 'Character not found',
        detail: 'No Wise Old Man entry found for the supplied username.',
        instance: request.nextUrl.pathname,
      });

      return applyRateLimitHeaders(
        NextResponse.json(problem, { status: problem.status }),
        rateLimitResult
      );
    }

    if (error instanceof WiseOldManRateLimitError) {
      const problem = createProblemDetails({
        status: 429,
        title: 'Upstream rate limit',
        detail: 'Wise Old Man is rate limiting requests. Try again soon.',
        instance: request.nextUrl.pathname,
      });

      return applyRateLimitHeaders(
        NextResponse.json(problem, { status: problem.status }),
        rateLimitResult
      );
    }

    if (error instanceof WiseOldManServerError) {
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

    console.error('Wise Old Man lookup error:', error);
    const problem = createProblemDetails({
      status: 500,
      title: 'Internal server error',
      detail: 'Unexpected error while processing Wise Old Man lookup.',
      instance: request.nextUrl.pathname,
    });

    return applyRateLimitHeaders(
      NextResponse.json(problem, { status: problem.status }),
      rateLimitResult
    );
  }
}
