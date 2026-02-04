import { createWikiPricesClient } from '@skillbound/wiki-api';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createProblemDetails } from '@/lib/api/problem-details';
import { checkRateLimit, getClientIp } from '@/lib/api/rate-limit';
import { getWikiCache, getWikiCacheTtlMs } from '@/lib/cache/wiki-cache';
import { serializePricesResponse } from '@/lib/wiki/wiki-prices';

const querySchema = z.object({
  timestamp: z
    .string()
    .optional()
    .transform((value) =>
      value === undefined ? undefined : Number.parseInt(value, 10)
    ),
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
  const parsed = querySchema.safeParse({
    timestamp: request.nextUrl.searchParams.get('timestamp') ?? undefined,
  });

  if (
    !parsed.success ||
    (parsed.data.timestamp !== undefined &&
      !Number.isFinite(parsed.data.timestamp))
  ) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid request',
      detail: 'Invalid timestamp.',
      errors: parsed.success ? undefined : parsed.error.issues,
      instance: request.nextUrl.pathname,
    });

    return NextResponse.json(problem, { status: problem.status });
  }

  const rateLimitId = `ge:1h:${getClientIp(request)}`;
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
    const cache = getWikiCache();
    const cacheTtlMs = getWikiCacheTtlMs('interval');
    const userAgent =
      process.env['SKILLBOUND_USER_AGENT'] ??
      process.env['INTEGRATIONS_USER_AGENT'] ??
      'Skillbound';
    const baseUrl = process.env['WIKI_PRICES_BASE_URL'];

    const client = createWikiPricesClient(userAgent, {
      cache,
      cacheTtlMs,
      ...(baseUrl ? { baseUrl } : {}),
    });

    const result = await client.get1HourPrices(parsed.data.timestamp);
    const response = NextResponse.json({
      data: serializePricesResponse(result),
    });

    return applyRateLimitHeaders(response, rateLimitResult);
  } catch (error) {
    console.error('GE 1h price error:', error);
    const problem = createProblemDetails({
      status: 502,
      title: 'Upstream error',
      detail: 'Failed to fetch 1-hour prices.',
      instance: request.nextUrl.pathname,
    });

    return applyRateLimitHeaders(
      NextResponse.json(problem, { status: problem.status }),
      rateLimitResult
    );
  }
}
