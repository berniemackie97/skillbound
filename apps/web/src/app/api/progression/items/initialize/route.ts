import {
  characterProgressionItems,
  eq,
  inArray,
  progressionCategories,
  type NewCharacterProgressionItem,
  userCharacters,
} from '@skillbound/database';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createProblemDetails } from '@/lib/api/problem-details';
import { getSessionUser, unauthorizedResponse } from '@/lib/auth/auth-helpers';
import { getDbClient } from '@/lib/db';

const initializeSchema = z.object({
  characterId: z.string().uuid(),
  categoryIds: z.array(z.string().uuid()).optional(),
});

/**
 * POST /api/progression/items/initialize
 * Initializes default progression items for a character from templates
 */
export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return unauthorizedResponse();
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = initializeSchema.safeParse(body);

  if (!parsed.success) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid initialization data',
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

    // Get categories to initialize (all if not specified)
    const categoriesToInit =
      parsed.data.categoryIds && parsed.data.categoryIds.length > 0
        ? await db
            .select()
            .from(progressionCategories)
            .where(inArray(progressionCategories.id, parsed.data.categoryIds))
        : await db.select().from(progressionCategories);

    // Build items to insert
    const now = new Date();
    const itemsToInsert: NewCharacterProgressionItem[] = [];

    for (const category of categoriesToInit) {
      const defaultItems = category.defaultItems as Array<{
        name: string;
        description?: string;
        itemType: 'unlock' | 'item' | 'gear' | 'goal' | 'custom';
        itemId?: number;
        unlockFlag?: string;
        orderIndex?: number;
      }>;

      if (defaultItems && Array.isArray(defaultItems)) {
        for (const template of defaultItems) {
          itemsToInsert.push({
            userCharacterId: parsed.data.characterId,
            categoryId: category.id,
            itemType: template.itemType,
            name: template.name,
            description: template.description ?? null,
            itemId: template.itemId ?? null,
            unlockFlag: template.unlockFlag ?? null,
            completed: false,
            completedAt: null,
            notes: null,
            orderIndex: template.orderIndex ?? 0,
            createdAt: now,
            updatedAt: now,
          });
        }
      }
    }

    // Insert all items
    const insertedItems =
      itemsToInsert.length > 0
        ? await db
            .insert(characterProgressionItems)
            .values(itemsToInsert)
            .returning()
        : [];

    return NextResponse.json({
      data: {
        items: insertedItems,
        count: insertedItems.length,
      },
      meta: {
        categoriesInitialized: categoriesToInit.length,
      },
    });
  } catch (error) {
    const problem = createProblemDetails({
      status: 500,
      title: 'Failed to initialize progression items',
      detail: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(problem, { status: problem.status });
  }
}
