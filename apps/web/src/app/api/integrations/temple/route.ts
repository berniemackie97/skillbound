import { ParseError } from '@skillbound/integrations/shared';
import {
  createTempleClient,
  TempleNotFoundError,
  TempleRateLimitError,
  TempleServerError,
  type TempleGainsPeriod,
} from '@skillbound/integrations/temple';
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
  include: z.string().optional(),
  period: z.string().optional(),
  interval: z.string().optional(),
});

const gainsPeriods = new Set<TempleGainsPeriod>([
  'day',
  'week',
  'month',
  'year',
  'custom',
]);
const includeOptions = new Set(['info', 'stats', 'gains', 'datapoints']);

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

function parseInclude(raw: string | undefined): string[] {
  if (!raw) {
    return ['info'];
  }

  const values = raw
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  if (values.length === 0) {
    return ['info'];
  }

  return values;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const parsed = querySchema.safeParse({
    username: searchParams.get('username') ?? '',
    include: searchParams.get('include') ?? undefined,
    period: searchParams.get('period') ?? undefined,
    interval: searchParams.get('interval') ?? undefined,
  });

  if (!parsed.success) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid request',
      detail: 'Invalid username or query parameters.',
      errors: parsed.error.issues,
      instance: request.nextUrl.pathname,
    });

    return NextResponse.json(problem, { status: problem.status });
  }

  const include = parseInclude(parsed.data.include);
  const invalidIncludes = include.filter((value) => !includeOptions.has(value));
  if (invalidIncludes.length > 0) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid include',
      detail: `Unsupported include values: ${invalidIncludes.join(', ')}`,
      instance: request.nextUrl.pathname,
    });

    return NextResponse.json(problem, { status: problem.status });
  }

  const period = parsed.data.period?.toLowerCase() ?? 'week';
  if (
    include.includes('gains') &&
    !gainsPeriods.has(period as TempleGainsPeriod)
  ) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid period',
      detail: `Unsupported gains period: ${period}`,
      instance: request.nextUrl.pathname,
    });

    return NextResponse.json(problem, { status: problem.status });
  }

  const rateLimitId = `temple:${getClientIp(request)}`;
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
  const cacheTtlMs = getIntegrationsCacheTtlMs('temple');
  const userAgent =
    process.env['SKILLBOUND_USER_AGENT'] ??
    process.env['INTEGRATIONS_USER_AGENT'];
  const client = createTempleClient({
    cache: null,
    ...(process.env['TEMPLE_BASE_URL']
      ? { baseUrl: process.env['TEMPLE_BASE_URL'] }
      : {}),
    ...(userAgent ? { userAgent } : {}),
  });

  async function resolveCached<T>(key: string, fetcher: () => Promise<T>) {
    if (cache) {
      const cached = await cache.get(key);
      if (cached) {
        return { cached: true, data: cached as T };
      }
    }

    const data = await fetcher();
    if (cache) {
      await cache.set(key, data, cacheTtlMs);
    }
    return { cached: false, data };
  }

  try {
    const data: Record<string, unknown> = {};
    const meta: Record<string, { cached: boolean }> = {};

    if (include.includes('info')) {
      const result = await resolveCached(
        `integrations:temple:info:${parsed.data.username.toLowerCase()}`,
        () => client.getPlayerInfo(parsed.data.username)
      );
      data['info'] = result.data;
      meta['info'] = { cached: result.cached };
    }

    if (include.includes('stats')) {
      const result = await resolveCached(
        `integrations:temple:stats:${parsed.data.username.toLowerCase()}`,
        () => client.getPlayerStats(parsed.data.username)
      );
      data['stats'] = result.data;
      meta['stats'] = { cached: result.cached };
    }

    if (include.includes('gains')) {
      const result = await resolveCached(
        `integrations:temple:gains:${parsed.data.username.toLowerCase()}:${period}`,
        () =>
          client.getPlayerGains(
            parsed.data.username,
            period as TempleGainsPeriod
          )
      );
      data['gains'] = result.data;
      meta['gains'] = { cached: result.cached };
    }

    if (include.includes('datapoints')) {
      const interval = parsed.data.interval ?? 'week';
      const result = await resolveCached(
        `integrations:temple:datapoints:${parsed.data.username.toLowerCase()}:${interval}`,
        () => client.getPlayerDatapoints(parsed.data.username, interval)
      );
      data['datapoints'] = result.data;
      meta['datapoints'] = { cached: result.cached };
    }

    const response = NextResponse.json({ data, meta });
    return applyRateLimitHeaders(response, rateLimitResult);
  } catch (error) {
    if (error instanceof TempleNotFoundError) {
      const problem = createProblemDetails({
        status: 404,
        title: 'Character not found',
        detail: 'No TempleOSRS entry found for the supplied username.',
        instance: request.nextUrl.pathname,
      });

      return applyRateLimitHeaders(
        NextResponse.json(problem, { status: problem.status }),
        rateLimitResult
      );
    }

    if (error instanceof TempleRateLimitError) {
      const problem = createProblemDetails({
        status: 429,
        title: 'Upstream rate limit',
        detail: 'TempleOSRS is rate limiting requests. Try again soon.',
        instance: request.nextUrl.pathname,
      });

      return applyRateLimitHeaders(
        NextResponse.json(problem, { status: problem.status }),
        rateLimitResult
      );
    }

    if (error instanceof TempleServerError) {
      const notFound = /not found|unknown/i.test(error.message);
      const status = notFound ? 404 : error.status >= 500 ? 502 : 400;
      const problem = createProblemDetails({
        status,
        title: status >= 500 ? 'Upstream error' : 'Upstream request error',
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

    console.error('TempleOSRS lookup error:', error);
    const problem = createProblemDetails({
      status: 500,
      title: 'Internal server error',
      detail: 'Unexpected error while processing TempleOSRS lookup.',
      instance: request.nextUrl.pathname,
    });

    return applyRateLimitHeaders(
      NextResponse.json(problem, { status: problem.status }),
      rateLimitResult
    );
  }
}
