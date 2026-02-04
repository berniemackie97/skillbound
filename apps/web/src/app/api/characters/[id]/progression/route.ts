import {
  characterProgressionItems,
  eq,
  userCharacters,
} from '@skillbound/database';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { mapErrorToResponse } from '@/lib/api/api-error-mapper';
import { createProblemDetails } from '@/lib/api/problem-details';
import { getDbClient } from '@/lib/db';
import { logger } from '@/lib/logging/logger';

const paramsSchema = z.object({
  id: z.string().uuid(),
});

const createItemSchema = z.object({
  categoryId: z.string().uuid().optional(),
  itemType: z.enum(['unlock', 'item', 'gear', 'goal', 'custom']),
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  itemId: z.number().int().positive().optional(),
  unlockFlag: z.string().max(100).optional(),
  orderIndex: z.number().int().default(0),
});

/**
 * GET /api/characters/[id]/progression
 * Get all progression items for a character, organized by category
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const parsed = paramsSchema.safeParse(params);

    if (!parsed.success) {
      const problem = createProblemDetails({
        status: 400,
        title: 'Invalid request',
        detail: 'Invalid character ID',
        errors: parsed.error.issues,
        instance: request.url,
      });
      return NextResponse.json(problem, { status: 400 });
    }

    const db = getDbClient();

    // Verify character exists
    const character = await db.query.userCharacters.findFirst({
      where: eq(userCharacters.id, parsed.data.id),
    });

    if (!character) {
      const problem = createProblemDetails({
        status: 404,
        title: 'Character not found',
        detail: 'The requested character does not exist',
        instance: request.url,
      });
      return NextResponse.json(problem, { status: 404 });
    }

    // Get all categories with their items
    const categories = await db.query.progressionCategories.findMany({
      orderBy: (categories, { asc }) => [asc(categories.orderIndex)],
    });

    // Get all progression items for this character
    const items = await db.query.characterProgressionItems.findMany({
      where: eq(characterProgressionItems.userCharacterId, parsed.data.id),
      orderBy: (items, { asc }) => [asc(items.orderIndex)],
    });

    // Organize items by category
    const itemsByCategory = items.reduce(
      (acc, item) => {
        const categoryId = item.categoryId || 'uncategorized';
        if (!acc[categoryId]) {
          acc[categoryId] = [];
        }
        acc[categoryId].push(item);
        return acc;
      },
      {} as Record<string, typeof items>
    );

    // Build response with categories and their items
    const categoriesWithItems = categories.map((category) => {
      const categoryItems = itemsByCategory[category.id] || [];
      return {
        ...category,
        items: categoryItems,
        completedCount: categoryItems.filter((item) => item.completed).length,
        totalCount: categoryItems.length,
      };
    });

    // Include uncategorized items
    const uncategorizedItems = itemsByCategory['uncategorized'] || [];
    if (uncategorizedItems.length > 0) {
      categoriesWithItems.push({
        id: 'uncategorized',
        name: 'Uncategorized',
        description: null,
        icon: null,
        orderIndex: 999,
        defaultItems: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        items: uncategorizedItems,
        completedCount: uncategorizedItems.filter((item) => item.completed)
          .length,
        totalCount: uncategorizedItems.length,
      });
    }

    // Calculate overall stats
    const totalItems = items.length;
    const completedItems = items.filter((item) => item.completed).length;

    return NextResponse.json({
      data: {
        categories: categoriesWithItems,
        stats: {
          totalItems,
          completedItems,
          completionPercentage:
            totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0,
        },
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Get progression items error');
    return mapErrorToResponse(error, request.url);
  }
}

/**
 * POST /api/characters/[id]/progression
 * Create a new progression item for a character
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const paramsValidation = paramsSchema.safeParse(params);

    if (!paramsValidation.success) {
      const problem = createProblemDetails({
        status: 400,
        title: 'Invalid request',
        detail: 'Invalid character ID',
        errors: paramsValidation.error.issues,
        instance: request.url,
      });
      return NextResponse.json(problem, { status: 400 });
    }

    const body: unknown = await request.json();
    const bodyValidation = createItemSchema.safeParse(body);

    if (!bodyValidation.success) {
      const problem = createProblemDetails({
        status: 400,
        title: 'Validation error',
        detail: 'Invalid progression item data',
        errors: bodyValidation.error.issues,
        instance: request.url,
      });
      return NextResponse.json(problem, { status: 400 });
    }

    const db = getDbClient();

    // Verify character exists
    const character = await db.query.userCharacters.findFirst({
      where: eq(userCharacters.id, paramsValidation.data.id),
    });

    if (!character) {
      const problem = createProblemDetails({
        status: 404,
        title: 'Character not found',
        detail: 'The requested character does not exist',
        instance: request.url,
      });
      return NextResponse.json(problem, { status: 404 });
    }

    // Create the progression item
    const [newItem] = await db
      .insert(characterProgressionItems)
      .values({
        userCharacterId: paramsValidation.data.id,
        categoryId: bodyValidation.data.categoryId || null,
        itemType: bodyValidation.data.itemType,
        name: bodyValidation.data.name,
        description: bodyValidation.data.description || null,
        itemId: bodyValidation.data.itemId || null,
        unlockFlag: bodyValidation.data.unlockFlag || null,
        orderIndex: bodyValidation.data.orderIndex,
        completed: false,
      })
      .returning();

    logger.info(
      {
        characterId: paramsValidation.data.id,
        itemId: newItem?.id,
        itemName: newItem?.name,
      },
      'Created progression item'
    );

    return NextResponse.json(
      {
        data: newItem,
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error({ err: error }, 'Create progression item error');
    return mapErrorToResponse(error, request.url);
  }
}
