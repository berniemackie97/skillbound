import { createWikiPricesClient } from '@skillbound/wiki-api';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createProblemDetails } from '@/lib/api/problem-details';
import { checkRateLimit, getClientIp } from '@/lib/api/rate-limit';
import { getWikiCache, getWikiCacheTtlMs } from '@/lib/cache/wiki-cache';

const querySchema = z.object({
  id: z
    .string()
    .optional()
    .transform((value) =>
      value === undefined ? undefined : Number.parseInt(value, 10)
    ),
  ids: z
    .string()
    .optional()
    .transform((value) => {
      if (!value) return undefined;
      return value
        .split(',')
        .map((entry) => Number.parseInt(entry.trim(), 10))
        .filter((entry) => Number.isFinite(entry));
    }),
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
    id: request.nextUrl.searchParams.get('id') ?? undefined,
    ids: request.nextUrl.searchParams.get('ids') ?? undefined,
  });

  if (
    !parsed.success ||
    (parsed.data.id !== undefined && !Number.isFinite(parsed.data.id)) ||
    (parsed.data.ids !== undefined && parsed.data.ids.length === 0)
  ) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid request',
      detail: 'Invalid item id.',
      errors: parsed.success ? undefined : parsed.error.issues,
      instance: request.nextUrl.pathname,
    });

    return NextResponse.json(problem, { status: problem.status });
  }

  const rateLimitId = `ge:mapping:${getClientIp(request)}`;
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
    const cacheTtlMs = getWikiCacheTtlMs('mapping');
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

    const mappings = await client.getItemMappings();
    const filtered = parsed.data.ids
      ? mappings.filter((item: { id: number }) =>
          parsed.data.ids?.includes(item.id)
        )
      : parsed.data.id
        ? mappings.filter((item: { id: number }) => item.id === parsed.data.id)
        : mappings;

    const response = NextResponse.json({ data: filtered });
    return applyRateLimitHeaders(response, rateLimitResult);
  } catch (error) {
    console.error('GE mapping error:', error);
    const problem = createProblemDetails({
      status: 502,
      title: 'Upstream error',
      detail: 'Failed to fetch item mappings.',
      instance: request.nextUrl.pathname,
    });

    return applyRateLimitHeaders(
      NextResponse.json(problem, { status: problem.status }),
      rateLimitResult
    );
  }
}
