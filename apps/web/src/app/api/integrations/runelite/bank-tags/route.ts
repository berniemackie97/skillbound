import { parseRuneLiteBankTagsExport } from '@skillbound/integrations/runelite';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { createProblemDetails } from '@/lib/api/problem-details';
import { checkRateLimit, getClientIp } from '@/lib/api/rate-limit';

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

export async function POST(request: NextRequest) {
  const rateLimitId = `runelite:bank-tags:${getClientIp(request)}`;
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

  const payload = await request.text();
  if (!payload.trim()) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid request',
      detail: 'Bank tag export payload is required.',
      instance: request.nextUrl.pathname,
    });

    return applyRateLimitHeaders(
      NextResponse.json(problem, { status: problem.status }),
      rateLimitResult
    );
  }

  const result = parseRuneLiteBankTagsExport(payload);
  const response = NextResponse.json({ data: result });
  return applyRateLimitHeaders(response, rateLimitResult);
}
