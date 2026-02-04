import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { searchItems } from '@/lib/trading/ge-service';
import { createProblemDetails } from '@/lib/api/problem-details';
import { checkRateLimit, getClientIp } from '@/lib/api/rate-limit';

const querySchema = z.object({
  q: z.string().min(1).max(100),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? Math.min(Math.max(1, parseInt(v, 10)), 50) : 10)),
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
 * GET /api/ge/search
 *
 * Search for GE items by name (for autocomplete)
 *
 * Query params:
 * - q: Search query (required)
 * - limit: Max results (default 10, max 50)
 */
export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse({
    q: request.nextUrl.searchParams.get('q') ?? '',
    limit: request.nextUrl.searchParams.get('limit') ?? undefined,
  });

  if (!parsed.success) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid request',
      detail: 'Search query is required.',
      errors: parsed.error.issues,
      instance: request.nextUrl.pathname,
    });
    return NextResponse.json(problem, { status: problem.status });
  }

  const rateLimitId = `ge:search:${getClientIp(request)}`;
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
    const results = await searchItems(parsed.data.q, parsed.data.limit);

    const response = NextResponse.json({ data: results });
    return applyRateLimitHeaders(response, rateLimitResult);
  } catch (error) {
    console.error('GE search error:', error);
    const problem = createProblemDetails({
      status: 502,
      title: 'Upstream error',
      detail: 'Failed to search items.',
      instance: request.nextUrl.pathname,
    });

    return applyRateLimitHeaders(
      NextResponse.json(problem, { status: problem.status }),
      rateLimitResult
    );
  }
}
