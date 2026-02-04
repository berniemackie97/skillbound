import {
  createWikiPricesClient,
  type TimeseriesTimestep,
} from '@skillbound/wiki-api';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createProblemDetails } from '@/lib/api/problem-details';
import { checkRateLimit, getClientIp } from '@/lib/api/rate-limit';
import { getWikiCache, getWikiCacheTtlMs } from '@/lib/cache/wiki-cache';

const querySchema = z.object({
  id: z.string().transform((value) => Number.parseInt(value, 10)),
  timestep: z.string().optional(),
  start: z
    .string()
    .optional()
    .transform((value) =>
      value === undefined ? undefined : Number.parseInt(value, 10)
    ),
  end: z
    .string()
    .optional()
    .transform((value) =>
      value === undefined ? undefined : Number.parseInt(value, 10)
    ),
});

const allowedTimesteps = new Set<TimeseriesTimestep>(['5m', '1h', '6h', '24h']);

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
    id: request.nextUrl.searchParams.get('id') ?? '',
    timestep: request.nextUrl.searchParams.get('timestep') ?? undefined,
    start: request.nextUrl.searchParams.get('start') ?? undefined,
    end: request.nextUrl.searchParams.get('end') ?? undefined,
  });

  if (!parsed.success || !Number.isFinite(parsed.data.id)) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid request',
      detail: 'Invalid item id.',
      errors: parsed.success ? undefined : parsed.error.issues,
      instance: request.nextUrl.pathname,
    });

    return NextResponse.json(problem, { status: problem.status });
  }

  const timestep = parsed.data.timestep?.toLowerCase() ?? '5m';
  if (!allowedTimesteps.has(timestep as TimeseriesTimestep)) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid timestep',
      detail: `Unsupported timestep: ${timestep}`,
      instance: request.nextUrl.pathname,
    });

    return NextResponse.json(problem, { status: problem.status });
  }

  if (parsed.data.start !== undefined && !Number.isFinite(parsed.data.start)) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid start',
      detail: 'Invalid start timestamp.',
      instance: request.nextUrl.pathname,
    });

    return NextResponse.json(problem, { status: problem.status });
  }

  if (parsed.data.end !== undefined && !Number.isFinite(parsed.data.end)) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid end',
      detail: 'Invalid end timestamp.',
      instance: request.nextUrl.pathname,
    });

    return NextResponse.json(problem, { status: problem.status });
  }

  const rateLimitId = `ge:timeseries:${getClientIp(request)}`;
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
    const cacheTtlMs = getWikiCacheTtlMs('timeseries');
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

    const result = await client.getTimeseries({
      itemId: parsed.data.id,
      timestep: timestep as TimeseriesTimestep,
      ...(parsed.data.start !== undefined ? { start: parsed.data.start } : {}),
      ...(parsed.data.end !== undefined ? { end: parsed.data.end } : {}),
    });

    const response = NextResponse.json({ data: result });
    return applyRateLimitHeaders(response, rateLimitResult);
  } catch (error) {
    console.error('GE timeseries error:', error);
    const problem = createProblemDetails({
      status: 502,
      title: 'Upstream error',
      detail: 'Failed to fetch timeseries data.',
      instance: request.nextUrl.pathname,
    });

    return applyRateLimitHeaders(
      NextResponse.json(problem, { status: problem.status }),
      rateLimitResult
    );
  }
}
