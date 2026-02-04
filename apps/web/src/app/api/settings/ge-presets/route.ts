import { eq, userSettings } from '@skillbound/database';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { createProblemDetails } from '@/lib/api/problem-details';
import { getSessionUser, unauthorizedResponse } from '@/lib/auth/auth-helpers';
import { getDbClient } from '@/lib/db';

const filterSchema = z.object({
  min: z.string(),
  max: z.string(),
});

const presetSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(60),
  members: z.enum(['all', 'members', 'f2p']),
  hideNegativeMargin: z.boolean(),
  hideNegativeRoi: z.boolean(),
  filters: z.object({
    buyPrice: filterSchema,
    sellPrice: filterSchema,
    margin: filterSchema,
    profit: filterSchema,
    roi: filterSchema,
    volume: filterSchema,
    potentialProfit: filterSchema,
  }),
});

const presetsSchema = z.array(presetSchema).max(50);

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorizedResponse();

  const db = getDbClient();
  const [settings] = await db
    .select({ gePresets: userSettings.gePresets })
    .from(userSettings)
    .where(eq(userSettings.userId, user.id))
    .limit(1);

  return NextResponse.json({ data: settings?.gePresets ?? [] });
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

  const parsed = presetsSchema.safeParse(body);
  if (!parsed.success) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid presets',
      detail: 'GE presets payload is invalid.',
      errors: parsed.error.issues,
    });
    return NextResponse.json(problem, { status: problem.status });
  }

  const db = getDbClient();

  await db
    .insert(userSettings)
    .values({ userId: user.id, gePresets: parsed.data })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: {
        gePresets: parsed.data,
        updatedAt: new Date(),
      },
    });

  return NextResponse.json({ data: parsed.data });
}
