import {
  and,
  bossKillcounts,
  collectionLogItems,
  eq,
  gearProgression,
  milestones,
  userCharacters,
} from '@skillbound/database';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionUser, unauthorizedResponse } from '@/lib/auth/auth-helpers';
import { getDbClient } from '@/lib/db';
import { createProblemDetails } from '@/lib/api/problem-details';

const updateSchema = z.object({
  characterId: z.string().uuid(),
  type: z.enum(['boss', 'gear', 'milestone', 'collectionLog']),
  id: z.string().uuid().optional(),
  bossName: z.string().optional(),
  data: z.object({
    killcount: z.number().int().min(0).optional(),
    obtained: z.boolean().optional(),
    achieved: z.boolean().optional(),
  }),
});

/**
 * PATCH /api/progression/update
 * Update any progression item
 */
export async function PATCH(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return unauthorizedResponse();
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
      .where(eq(userCharacters.id, parsed.data.characterId))
      .limit(1);

    if (!character || character.userId !== user.id) {
      const problem = createProblemDetails({
        status: 404,
        title: 'Character not found',
      });
      return NextResponse.json(problem, { status: problem.status });
    }

    const now = new Date();

    // Handle different update types
    if (
      parsed.data.type === 'boss' &&
      parsed.data.bossName &&
      parsed.data.data.killcount !== undefined
    ) {
      const [result] = await db
        .update(bossKillcounts)
        .set({
          killcount: parsed.data.data.killcount,
          lastUpdated: now,
        })
        .where(
          and(
            eq(bossKillcounts.userCharacterId, parsed.data.characterId),
            eq(bossKillcounts.bossName, parsed.data.bossName)
          )
        )
        .returning();

      return NextResponse.json({ data: result });
    }

    if (
      parsed.data.type === 'gear' &&
      parsed.data.id &&
      parsed.data.data.obtained !== undefined
    ) {
      const [result] = await db
        .update(gearProgression)
        .set({
          obtained: parsed.data.data.obtained,
          obtainedAt: parsed.data.data.obtained ? now : null,
          updatedAt: now,
        })
        .where(eq(gearProgression.id, parsed.data.id))
        .returning();

      return NextResponse.json({ data: result });
    }

    if (
      parsed.data.type === 'milestone' &&
      parsed.data.id &&
      parsed.data.data.achieved !== undefined
    ) {
      const [result] = await db
        .update(milestones)
        .set({
          achieved: parsed.data.data.achieved,
          achievedAt: parsed.data.data.achieved ? now : null,
          updatedAt: now,
        })
        .where(eq(milestones.id, parsed.data.id))
        .returning();

      return NextResponse.json({ data: result });
    }

    if (
      parsed.data.type === 'collectionLog' &&
      parsed.data.id &&
      parsed.data.data.obtained !== undefined
    ) {
      const [result] = await db
        .update(collectionLogItems)
        .set({
          obtained: parsed.data.data.obtained,
          obtainedAt: parsed.data.data.obtained ? now : null,
          updatedAt: now,
        })
        .where(eq(collectionLogItems.id, parsed.data.id))
        .returning();

      return NextResponse.json({ data: result });
    }

    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid update parameters',
    });
    return NextResponse.json(problem, { status: problem.status });
  } catch (error) {
    const problem = createProblemDetails({
      status: 500,
      title: 'Failed to update progression item',
      detail: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(problem, { status: problem.status });
  }
}
