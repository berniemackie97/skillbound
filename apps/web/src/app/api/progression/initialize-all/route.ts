import {
  ALL_BOSSES,
  ALL_GEAR_STAGES,
  ALL_MILESTONES,
  bossKillcounts,
  eq,
  gearProgression,
  milestones,
  type NewBossKillcount,
  type NewGearProgressionItem,
  type NewMilestone,
  userCharacters,
} from '@skillbound/database';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionUser, unauthorizedResponse } from '@/lib/auth/auth-helpers';
import { getDbClient } from '@/lib/db';
import { createProblemDetails } from '@/lib/api/problem-details';

const initSchema = z.object({
  characterId: z.string().uuid(),
});

/**
 * POST /api/progression/initialize-all
 * Initialize all progression tracking for a character (bosses, gear, milestones)
 */
export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return unauthorizedResponse();
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = initSchema.safeParse(body);

  if (!parsed.success) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid request data',
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

    // Initialize boss killcounts
    const bossesToInsert: NewBossKillcount[] = ALL_BOSSES.map((boss) => ({
      userCharacterId: parsed.data.characterId,
      bossName: boss.name,
      killcount: 0,
      personalBest: null,
      lastUpdated: now,
      createdAt: now,
    }));

    const insertedBosses =
      bossesToInsert.length > 0
        ? await db
            .insert(bossKillcounts)
            .values(bossesToInsert)
            .onConflictDoNothing()
            .returning()
        : [];

    // Initialize gear progression
    const gearToInsert: NewGearProgressionItem[] = [];
    for (const [stage, items] of Object.entries(ALL_GEAR_STAGES)) {
      items.forEach((item, index) => {
        gearToInsert.push({
          userCharacterId: parsed.data.characterId,
          gameStage: stage as 'early' | 'mid' | 'late' | 'end' | 'specialized',
          slot: item.slot,
          itemName: item.itemName,
          itemId: item.itemId ?? null,
          obtained: false,
          obtainedAt: null,
          source: item.source,
          priority: item.priority,
          notes: null,
          orderIndex: index,
          createdAt: now,
          updatedAt: now,
        });
      });
    }

    const insertedGear =
      gearToInsert.length > 0
        ? await db
            .insert(gearProgression)
            .values(gearToInsert)
            .onConflictDoNothing()
            .returning()
        : [];

    // Initialize milestones
    const milestonesToInsert: NewMilestone[] = [];
    for (const [difficulty, items] of Object.entries(ALL_MILESTONES)) {
      items.forEach((item, index) => {
        milestonesToInsert.push({
          userCharacterId: parsed.data.characterId,
          categoryId: null,
          difficulty: difficulty as 'easy' | 'medium' | 'hard' | 'elite' | 'master',
          name: item.name,
          description: item.description ?? null,
          requirements: (item.requirements ?? null) as Array<{
            type: 'skill' | 'quest' | 'item' | 'killcount' | 'custom';
            name: string;
            value: number | boolean;
          }> | null,
          achieved: false,
          achievedAt: null,
          notes: null,
          orderIndex: index,
          createdAt: now,
          updatedAt: now,
        });
      });
    }

    const insertedMilestones =
      milestonesToInsert.length > 0
        ? await db
            .insert(milestones)
            .values(milestonesToInsert)
            .onConflictDoNothing()
            .returning()
        : [];

    return NextResponse.json({
      data: {
        bosses: insertedBosses,
        gear: insertedGear,
        milestones: insertedMilestones,
      },
      meta: {
        bossesCreated: insertedBosses.length,
        gearCreated: insertedGear.length,
        milestonesCreated: insertedMilestones.length,
      },
    });
  } catch (error) {
    const problem = createProblemDetails({
      status: 500,
      title: 'Failed to initialize progression data',
      detail: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(problem, { status: problem.status });
  }
}
