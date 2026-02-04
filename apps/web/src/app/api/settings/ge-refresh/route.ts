import { eq, userSettings } from '@skillbound/database';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { getSessionUser, unauthorizedResponse } from '@/lib/auth/auth-helpers';
import { getDbClient } from '@/lib/db';
import { createProblemDetails } from '@/lib/api/problem-details';

const refreshSchema = z.object({
  intervalMs: z.number().int(),
  paused: z.boolean(),
});

const allowedIntervals = new Set([30_000, 45_000, 60_000, 90_000, 120_000]);

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorizedResponse();

  const db = getDbClient();
  const [settings] = await db
    .select({
      intervalMs: userSettings.geRefreshIntervalMs,
      paused: userSettings.geRefreshPaused,
    })
    .from(userSettings)
    .where(eq(userSettings.userId, user.id))
    .limit(1);

  return NextResponse.json({
    data: {
      intervalMs: settings?.intervalMs ?? 45_000,
      paused: settings?.paused ?? false,
    },
  });
}

export async function PUT(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorizedResponse();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid JSON',
      detail: 'Request body must be valid JSON.',
    });
    return NextResponse.json(problem, { status: problem.status });
  }

  const parsed = refreshSchema.safeParse(body);
  if (!parsed.success) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid refresh settings',
      detail: 'Refresh settings payload is invalid.',
      errors: parsed.error.issues,
    });
    return NextResponse.json(problem, { status: problem.status });
  }

  if (!allowedIntervals.has(parsed.data.intervalMs)) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid refresh interval',
      detail: 'Refresh interval must be one of the allowed options.',
    });
    return NextResponse.json(problem, { status: problem.status });
  }

  const db = getDbClient();
  await db
    .insert(userSettings)
    .values({
      userId: user.id,
      geRefreshIntervalMs: parsed.data.intervalMs,
      geRefreshPaused: parsed.data.paused,
    })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: {
        geRefreshIntervalMs: parsed.data.intervalMs,
        geRefreshPaused: parsed.data.paused,
        updatedAt: new Date(),
      },
    });

  return NextResponse.json({ data: parsed.data });
}
