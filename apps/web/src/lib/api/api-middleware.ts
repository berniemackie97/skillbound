import type { NextResponse } from 'next/server';

import type { RateLimitResult } from './rate-limit';

/**
 * Applies rate limit headers to a NextResponse
 * Standardizes rate limit header format across all routes
 */
export function applyRateLimitHeaders(
  response: NextResponse,
  rateLimitResult: RateLimitResult
): NextResponse {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  response.headers.set('RateLimit-Limit', String(rateLimitResult.limit));
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  response.headers.set(
    'RateLimit-Remaining',
    String(rateLimitResult.remaining)
  );
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  response.headers.set('RateLimit-Reset', String(rateLimitResult.reset));
  return response;
}

/**
 * Creates a standardized cache key for hiscores lookups
 */
export function buildHiscoresCacheKey(username: string, mode: string): string {
  return `hiscores:${mode}:${username.toLowerCase()}`;
}
