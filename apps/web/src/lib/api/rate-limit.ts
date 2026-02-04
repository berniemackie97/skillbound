import { Ratelimit } from '@upstash/ratelimit';
import type { NextRequest } from 'next/server';

import { getRedisClient } from '../cache/redis';

const redis = getRedisClient();

const parsedRequests = Number(process.env['RATE_LIMIT_REQUESTS'] ?? '30');
const parsedWindow = Number(process.env['RATE_LIMIT_WINDOW_SECONDS'] ?? '60');
const requestsPerWindow = Number.isFinite(parsedRequests) ? parsedRequests : 30;
const windowSeconds = Number.isFinite(parsedWindow) ? parsedWindow : 60;

const ratelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(requestsPerWindow, `${windowSeconds}s`),
      analytics: true,
    })
  : null;

export type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
};

export function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() ?? 'unknown';
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }

  return 'unknown';
}

export async function checkRateLimit(identifier: string) {
  if (!ratelimit) {
    return {
      success: true,
      limit: requestsPerWindow,
      remaining: requestsPerWindow,
      reset: 0,
    };
  }

  return ratelimit.limit(identifier);
}
