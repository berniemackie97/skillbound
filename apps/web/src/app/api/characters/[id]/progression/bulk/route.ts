import {
  characterProgressionItems,
  eq,
  progressionCategories,
  PROGRESSION_CATEGORIES,
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

const bulkImportSchema = z.object({
  templateId: z.string(),
  categoryNames: z.array(z.string()).optional(), // Filter by category names
});

/**
 * POST /api/characters/[id]/progression/bulk
 * Import progression items from a template
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
    const bodyValidation = bulkImportSchema.safeParse(body);

    if (!bodyValidation.success) {
      const problem = createProblemDetails({
        status: 400,
        title: 'Validation error',
        detail: 'Invalid import data',
        errors: bodyValidation.error.issues,
        instance: request.url,
      });
      return NextResponse.json(problem, { status: 400 });
    }

    if (bodyValidation.data.templateId !== 'ironman-essentials') {
      const problem = createProblemDetails({
        status: 404,
        title: 'Template not found',
        detail: 'The requested template does not exist',
        instance: request.url,
      });
      return NextResponse.json(problem, { status: 404 });
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

    // Filter categories if specified
    type Category = (typeof PROGRESSION_CATEGORIES)[number];
    const categoriesToImport = bodyValidation.data.categoryNames
      ? PROGRESSION_CATEGORIES.filter((cat: Category) =>
          bodyValidation.data.categoryNames?.includes(cat.name)
        )
      : PROGRESSION_CATEGORIES;

    let totalImported = 0;

    await db.transaction(async (tx) => {
      // First, ensure categories exist in the database
      for (const categoryTemplate of categoriesToImport) {
        // Check if category exists
        const existingCategory = await tx.query.progressionCategories.findFirst(
          {
            where: eq(progressionCategories.name, categoryTemplate.name),
          }
        );

        let categoryId: string;

        if (!existingCategory) {
          // Create category
          const [newCategory] = await tx
            .insert(progressionCategories)
            .values({
              name: categoryTemplate.name,
              description: categoryTemplate.description,
              icon: categoryTemplate.icon,
              orderIndex: categoryTemplate.orderIndex,
              defaultItems: categoryTemplate.defaultItems,
            })
            .returning();
          if (!newCategory) {
            throw new Error(
              `Failed to create category: ${categoryTemplate.name}`
            );
          }
          categoryId = newCategory.id;
        } else {
          categoryId = existingCategory.id;
        }

        // Import items for this category
        for (const itemTemplate of categoryTemplate.defaultItems) {
          // Check if item already exists for this character
          const existingItem =
            await tx.query.characterProgressionItems.findFirst({
              where: (items, { and, eq }) =>
                and(
                  eq(items.userCharacterId, paramsValidation.data.id),
                  eq(items.name, itemTemplate.name),
                  eq(items.categoryId, categoryId)
                ),
            });

          if (!existingItem) {
            await tx.insert(characterProgressionItems).values({
              userCharacterId: paramsValidation.data.id,
              categoryId,
              itemType: itemTemplate.itemType,
              name: itemTemplate.name,
              description: itemTemplate.description || null,
              itemId: itemTemplate.itemId || null,
              unlockFlag: itemTemplate.unlockFlag || null,
              orderIndex: itemTemplate.orderIndex || 0,
              completed: false,
            });
            totalImported++;
          }
        }
      }
    });

    logger.info(
      {
        characterId: paramsValidation.data.id,
        templateId: bodyValidation.data.templateId,
        imported: totalImported,
      },
      'Bulk imported progression items'
    );

    return NextResponse.json(
      {
        data: {
          imported: totalImported,
          message: `Successfully imported ${totalImported} progression items`,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error({ err: error }, 'Bulk import progression items error');
    return mapErrorToResponse(error, request.url);
  }
}
