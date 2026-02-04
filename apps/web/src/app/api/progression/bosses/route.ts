import {
  bossKillcounts,
  eq,
  userCharacters,
} from '@skillbound/database';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionUser, unauthorizedResponse } from '@/lib/auth/auth-helpers';
import { getDbClient } from '@/lib/db';
import { createProblemDetails } from '@/lib/api/problem-details';

const querySchema = z.object({
  characterId: z.string().uuid(),
});

const updateSchema = z.object({
  killcount: z.number().int().min(0),
  personalBest: z.number().int().min(0).optional().nullable(),
});

/**
 * GET /api/progression/bosses?characterId={id}
 * Get all boss killcounts for a character
 */
export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return unauthorizedResponse();
  }

  const searchParams = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = querySchema.safeParse(searchParams);

  if (!parsed.success) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid query parameters',
      errors: parsed.error.issues,
    });
    return NextResponse.json(problem, { status: problem.status });
  }

  try {
    const db = getDbClient();

    // Verify character ownership
    const [character] = await db
      .select()
      .from(userCharacters)
      .where(eq(userCharacters.id, parsed.data.characterId))
      .limit(1);

    if (!character || character.userId !== user.id) {
      const problem = createProblemDetails({
        status: 404,
        title: 'Character not found',
      });
      return NextResponse.json(problem, { status: problem.status });
    }

    const killcounts = await db
      .select()
      .from(bossKillcounts)
      .where(eq(bossKillcounts.userCharacterId, parsed.data.characterId))
      .orderBy(bossKillcounts.bossName);

    return NextResponse.json({
      data: killcounts,
      meta: { count: killcounts.length },
    });
  } catch (error) {
    const problem = createProblemDetails({
      status: 500,
      title: 'Failed to fetch boss killcounts',
      detail: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(problem, { status: problem.status });
  }
}

/**
 * PATCH /api/progression/bosses/{bossName}?characterId={id}
 * Update boss killcount
 */
export async function PATCH(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return unauthorizedResponse();
  }

  const searchParams = Object.fromEntries(request.nextUrl.searchParams);
  const { characterId } = querySchema.parse(searchParams);
  const bossName = searchParams['bossName'];

  if (!bossName) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Missing boss name',
    });
    return NextResponse.json(problem, { status: problem.status });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid update data',
      errors: parsed.error.issues,
    });
    return NextResponse.json(problem, { status: problem.status });
  }

  try {
    const db = getDbClient();

    // Verify character ownership
    const [character] = await db
      .select()
      .from(userCharacters)
      .where(eq(userCharacters.id, characterId))
      .limit(1);

    if (!character || character.userId !== user.id) {
      const problem = createProblemDetails({
        status: 404,
        title: 'Character not found',
      });
      return NextResponse.json(problem, { status: problem.status });
    }

    const now = new Date();

    // Upsert killcount
    const [result] = await db
      .insert(bossKillcounts)
      .values({
        userCharacterId: characterId,
        bossName,
        killcount: parsed.data.killcount,
        personalBest: parsed.data.personalBest ?? null,
        lastUpdated: now,
        createdAt: now,
      })
      .onConflictDoUpdate({
        target: [bossKillcounts.userCharacterId, bossKillcounts.bossName],
        set: {
          killcount: parsed.data.killcount,
          personalBest: parsed.data.personalBest ?? null,
          lastUpdated: now,
        },
      })
      .returning();

    return NextResponse.json({ data: result });
  } catch (error) {
    const problem = createProblemDetails({
      status: 500,
      title: 'Failed to update boss killcount',
      detail: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(problem, { status: problem.status });
  }
}
