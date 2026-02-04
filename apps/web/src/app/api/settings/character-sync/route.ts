import { eq, userSettings } from '@skillbound/database';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionUser, unauthorizedResponse } from '@/lib/auth/auth-helpers';
import { getDbClient } from '@/lib/db';
import { createProblemDetails } from '@/lib/api/problem-details';

const updateSchema = z.object({
  enabled: z.boolean(),
  intervalHours: z.number().int().min(6).max(168),
});

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return unauthorizedResponse();
  }

  const db = getDbClient();
  const [settings] = await db
    .select({
      enabled: userSettings.characterSyncEnabled,
      intervalHours: userSettings.characterSyncIntervalHours,
    })
    .from(userSettings)
    .where(eq(userSettings.userId, user.id))
    .limit(1);

  const payload = settings ?? { enabled: true, intervalHours: 24 };

  return NextResponse.json({ data: payload });
}

export async function PATCH(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return unauthorizedResponse();
  }

  const payload = (await request.json().catch(() => null)) as unknown;
  const parsed = updateSchema.safeParse(payload);
  if (!parsed.success) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid sync settings',
      detail: 'Provide a valid cadence and enabled flag.',
      errors: parsed.error.issues,
    });
    return NextResponse.json(problem, { status: problem.status });
  }

  const db = getDbClient();
  const now = new Date();
  const [updated] = await db
    .insert(userSettings)
    .values({
      userId: user.id,
      characterSyncEnabled: parsed.data.enabled,
      characterSyncIntervalHours: parsed.data.intervalHours,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: {
        characterSyncEnabled: parsed.data.enabled,
        characterSyncIntervalHours: parsed.data.intervalHours,
        updatedAt: now,
      },
    })
    .returning({
      enabled: userSettings.characterSyncEnabled,
      intervalHours: userSettings.characterSyncIntervalHours,
    });

  return NextResponse.json({ data: updated });
}
