import {
  and,
  characterProgressionItems,
  eq,
  userCharacters,
} from '@skillbound/database';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createProblemDetails } from '@/lib/api/problem-details';
import { getSessionUser, unauthorizedResponse } from '@/lib/auth/auth-helpers';
import { getDbClient } from '@/lib/db';

const createItemSchema = z.object({
  characterId: z.string().uuid(),
  categoryId: z.string().uuid().optional().nullable(),
  itemType: z.enum(['unlock', 'item', 'gear', 'goal', 'custom']),
  name: z.string().min(1).max(255),
  description: z.string().max(500).optional().nullable(),
  itemId: z.number().int().positive().optional().nullable(),
  unlockFlag: z.string().max(100).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  orderIndex: z.number().int().default(0),
});

const querySchema = z.object({
  characterId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  completed: z
    .string()
    .optional()
    .transform((val) => {
      if (val === 'true') return true;
      if (val === 'false') return false;
      return undefined;
    }),
});

/**
 * GET /api/progression/items
 * Retrieves progression items for a character (requires auth)
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
      detail: 'Query parameters did not match expected schema.',
      errors: parsed.error.issues,
    });

    return NextResponse.json(problem, { status: problem.status });
  }

  try {
    const db = getDbClient();

    // If characterId is provided, verify ownership
    if (parsed.data.characterId) {
      const [character] = await db
        .select()
        .from(userCharacters)
        .where(eq(userCharacters.id, parsed.data.characterId))
        .limit(1);

      if (!character || character.userId !== user.id) {
        const problem = createProblemDetails({
          status: 404,
          title: 'Character not found',
          detail: 'Character does not exist or you do not have access to it.',
        });

        return NextResponse.json(problem, { status: problem.status });
      }

      // Build filters
      const filters = [
        eq(characterProgressionItems.userCharacterId, parsed.data.characterId),
      ];

      if (parsed.data.categoryId) {
        filters.push(
          eq(characterProgressionItems.categoryId, parsed.data.categoryId)
        );
      }

      if (parsed.data.completed !== undefined) {
        filters.push(
          eq(characterProgressionItems.completed, parsed.data.completed)
        );
      }

      const whereClause = filters.length === 1 ? filters[0] : and(...filters);

      const items = await db
        .select()
        .from(characterProgressionItems)
        .where(whereClause)
        .orderBy(
          characterProgressionItems.orderIndex,
          characterProgressionItems.createdAt
        );

      return NextResponse.json({
        data: items,
        meta: {
          count: items.length,
          characterId: parsed.data.characterId,
        },
      });
    }

    // If no characterId, return empty array
    return NextResponse.json({
      data: [],
      meta: {
        count: 0,
      },
    });
  } catch (error) {
    const problem = createProblemDetails({
      status: 500,
      title: 'Failed to fetch progression items',
      detail: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(problem, { status: problem.status });
  }
}

/**
 * POST /api/progression/items
 * Creates a new progression item for a character (requires auth)
 */
export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return unauthorizedResponse();
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = createItemSchema.safeParse(body);

  if (!parsed.success) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid progression item data',
      detail: 'Request body did not match expected schema.',
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
        detail: 'Character does not exist or you do not have access to it.',
      });

      return NextResponse.json(problem, { status: problem.status });
    }

    const now = new Date();
    const [item] = await db
      .insert(characterProgressionItems)
      .values({
        userCharacterId: parsed.data.characterId,
        categoryId: parsed.data.categoryId ?? null,
        itemType: parsed.data.itemType,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        itemId: parsed.data.itemId ?? null,
        unlockFlag: parsed.data.unlockFlag ?? null,
        completed: false,
        notes: parsed.data.notes ?? null,
        orderIndex: parsed.data.orderIndex,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return NextResponse.json({
      data: item,
    });
  } catch (error) {
    const problem = createProblemDetails({
      status: 500,
      title: 'Failed to create progression item',
      detail: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(problem, { status: problem.status });
  }
}
