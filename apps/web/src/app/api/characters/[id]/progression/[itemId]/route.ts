import {
  characterProgressionItems,
  eq,
  userCharacters,
} from '@skillbound/database';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { mapErrorToResponse } from '@/lib/api/api-error-mapper';
import { getDbClient } from '@/lib/db';
import { logger } from '@/lib/logging/logger';
import { createProblemDetails } from '@/lib/api/problem-details';

const paramsSchema = z.object({
  id: z.string().uuid(),
  itemId: z.string().uuid(),
});

const updateItemSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  completed: z.boolean().optional(),
  notes: z.string().max(2000).optional(),
  orderIndex: z.number().int().optional(),
});

/**
 * PATCH /api/characters/[id]/progression/[itemId]
 * Update a progression item (typically to toggle completion)
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const params = await context.params;
    const paramsValidation = paramsSchema.safeParse(params);

    if (!paramsValidation.success) {
      const problem = createProblemDetails({
        status: 400,
        title: 'Invalid request',
        detail: 'Invalid character or item ID',
        errors: paramsValidation.error.issues,
        instance: request.url,
      });
      return NextResponse.json(problem, { status: 400 });
    }

    const body: unknown = await request.json();
    const bodyValidation = updateItemSchema.safeParse(body);

    if (!bodyValidation.success) {
      const problem = createProblemDetails({
        status: 400,
        title: 'Validation error',
        detail: 'Invalid update data',
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

    // Verify item exists and belongs to this character
    const existingItem = await db.query.characterProgressionItems.findFirst({
      where: eq(characterProgressionItems.id, paramsValidation.data.itemId),
    });

    if (!existingItem) {
      const problem = createProblemDetails({
        status: 404,
        title: 'Progression item not found',
        detail: 'The requested progression item does not exist',
        instance: request.url,
      });
      return NextResponse.json(problem, { status: 404 });
    }

    if (existingItem.userCharacterId !== paramsValidation.data.id) {
      const problem = createProblemDetails({
        status: 403,
        title: 'Forbidden',
        detail: 'This progression item belongs to a different character',
        instance: request.url,
      });
      return NextResponse.json(problem, { status: 403 });
    }

    // Build update object
    const updates: Record<string, unknown> = {};
    if (bodyValidation.data.name !== undefined) {
      updates['name'] = bodyValidation.data.name;
    }
    if (bodyValidation.data.description !== undefined) {
      updates['description'] = bodyValidation.data.description;
    }
    if (bodyValidation.data.notes !== undefined) {
      updates['notes'] = bodyValidation.data.notes;
    }
    if (bodyValidation.data.orderIndex !== undefined) {
      updates['orderIndex'] = bodyValidation.data.orderIndex;
    }
    if (bodyValidation.data.completed !== undefined) {
      updates['completed'] = bodyValidation.data.completed;
      // Set completedAt when marking as complete
      if (bodyValidation.data.completed) {
        updates['completedAt'] = new Date();
      } else {
        updates['completedAt'] = null;
      }
    }

    // Update the item
    const [updatedItem] = await db
      .update(characterProgressionItems)
      .set(updates)
      .where(eq(characterProgressionItems.id, paramsValidation.data.itemId))
      .returning();

    logger.info(
      {
        characterId: paramsValidation.data.id,
        itemId: paramsValidation.data.itemId,
        updates,
      },
      'Updated progression item'
    );

    return NextResponse.json({
      data: updatedItem,
    });
  } catch (error) {
    logger.error({ err: error }, 'Update progression item error');
    return mapErrorToResponse(error, request.url);
  }
}

/**
 * DELETE /api/characters/[id]/progression/[itemId]
 * Delete a progression item
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const params = await context.params;
    const paramsValidation = paramsSchema.safeParse(params);

    if (!paramsValidation.success) {
      const problem = createProblemDetails({
        status: 400,
        title: 'Invalid request',
        detail: 'Invalid character or item ID',
        errors: paramsValidation.error.issues,
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

    // Verify item exists and belongs to this character
    const existingItem = await db.query.characterProgressionItems.findFirst({
      where: eq(characterProgressionItems.id, paramsValidation.data.itemId),
    });

    if (!existingItem) {
      const problem = createProblemDetails({
        status: 404,
        title: 'Progression item not found',
        detail: 'The requested progression item does not exist',
        instance: request.url,
      });
      return NextResponse.json(problem, { status: 404 });
    }

    if (existingItem.userCharacterId !== paramsValidation.data.id) {
      const problem = createProblemDetails({
        status: 403,
        title: 'Forbidden',
        detail: 'This progression item belongs to a different character',
        instance: request.url,
      });
      return NextResponse.json(problem, { status: 403 });
    }

    // Delete the item
    await db
      .delete(characterProgressionItems)
      .where(eq(characterProgressionItems.id, paramsValidation.data.itemId));

    logger.info(
      {
        characterId: paramsValidation.data.id,
        itemId: paramsValidation.data.itemId,
      },
      'Deleted progression item'
    );

    return NextResponse.json(
      {
        success: true,
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error({ err: error }, 'Delete progression item error');
    return mapErrorToResponse(error, request.url);
  }
}
