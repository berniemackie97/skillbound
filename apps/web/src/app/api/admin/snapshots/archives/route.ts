import {
  and,
  desc,
  eq,
  gte,
  lte,
  snapshotArchives,
} from '@skillbound/database';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createProblemDetails } from '@/lib/api/problem-details';
import { getDbClient } from '@/lib/db';

const tiers = ['realtime', 'hourly', 'daily', 'weekly', 'monthly', 'milestone'] as const;
const reasons = ['promotion', 'expiration', 'manual'] as const;

const querySchema = z.object({
  profileId: z.string().uuid().optional(),
  sourceTier: z.enum(tiers).optional(),
  targetTier: z.enum(tiers).optional(),
  reason: z.enum(reasons).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional().default(100),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

function resolveCronSecret(request: NextRequest): string | null {
  const headerSecret = request.headers.get('x-skillbound-cron-secret');
  if (headerSecret) {
    return headerSecret;
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return null;
  }

  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length).trim();
  }

  return null;
}

export async function GET(request: NextRequest) {
  const configuredSecret = process.env['CRON_SECRET']?.trim();
  const providedSecret = resolveCronSecret(request);

  if (configuredSecret && providedSecret !== configuredSecret) {
    const problem = createProblemDetails({
      status: 401,
      title: 'Unauthorized',
      detail: 'Missing or invalid cron secret.',
      instance: request.nextUrl.pathname,
    });

    return NextResponse.json(problem, { status: problem.status });
  }

  const parsed = querySchema.safeParse({
    profileId: request.nextUrl.searchParams.get('profileId') ?? undefined,
    sourceTier: request.nextUrl.searchParams.get('sourceTier') ?? undefined,
    targetTier: request.nextUrl.searchParams.get('targetTier') ?? undefined,
    reason: request.nextUrl.searchParams.get('reason') ?? undefined,
    from: request.nextUrl.searchParams.get('from') ?? undefined,
    to: request.nextUrl.searchParams.get('to') ?? undefined,
    limit: request.nextUrl.searchParams.get('limit') ?? undefined,
    offset: request.nextUrl.searchParams.get('offset') ?? undefined,
  });

  if (!parsed.success) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid query parameters',
      detail: 'One or more parameters are invalid.',
      errors: parsed.error.issues,
      instance: request.nextUrl.pathname,
    });

    return NextResponse.json(problem, { status: problem.status });
  }

  const { profileId, sourceTier, targetTier, reason, from, to, limit, offset } =
    parsed.data;

  const conditions = [];

  if (profileId) {
    conditions.push(eq(snapshotArchives.profileId, profileId));
  }
  if (sourceTier) {
    conditions.push(eq(snapshotArchives.sourceTier, sourceTier));
  }
  if (targetTier) {
    conditions.push(eq(snapshotArchives.targetTier, targetTier));
  }
  if (reason) {
    conditions.push(eq(snapshotArchives.reason, reason));
  }
  if (from) {
    conditions.push(gte(snapshotArchives.capturedFrom, new Date(from)));
  }
  if (to) {
    conditions.push(lte(snapshotArchives.capturedTo, new Date(to)));
  }

  const db = getDbClient();
  const query = db
    .select()
    .from(snapshotArchives)
    .orderBy(desc(snapshotArchives.createdAt))
    .limit(limit)
    .offset(offset);

  const data =
    conditions.length > 0 ? await query.where(and(...conditions)) : await query;

  return NextResponse.json({
    data,
    meta: {
      limit,
      offset,
      count: data.length,
      generatedAt: new Date().toISOString(),
    },
  });
}
