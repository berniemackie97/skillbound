import {
  characterProgressionItems,
  eq,
  type CharacterProgressionItem,
  userCharacters,
} from '@skillbound/database';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionUser, unauthorizedResponse } from '@/lib/auth/auth-helpers';
import { getDbClient } from '@/lib/db';
import { createProblemDetails } from '@/lib/api/problem-details';

const updateItemSchema = z.object({
  completed: z.boolean().optional(),
  notes: z.string().max(1000).optional().nullable(),
  orderIndex: z.number().int().optional(),
  categoryId: z.string().uuid().optional().nullable(),
});

/**
 * PATCH /api/progression/items/[id]
 * Updates a progression item (requires auth)
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return unauthorizedResponse();
  }

  const { id } = await context.params;
  const body: unknown = await request.json().catch(() => null);
  const parsed = updateItemSchema.safeParse(body);

  if (!parsed.success) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid update data',
      detail: 'Request body did not match expected schema.',
      errors: parsed.error.issues,
    });

    return NextResponse.json(problem, { status: problem.status });
  }

  try {
    const db = getDbClient();

    // Get the item and verify ownership through character
    const [existingItem] = await db
      .select({
        item: characterProgressionItems,
        character: userCharacters,
      })
      .from(characterProgressionItems)
      .innerJoin(
        userCharacters,
        eq(characterProgressionItems.userCharacterId, userCharacters.id)
      )
      .where(eq(characterProgressionItems.id, id))
      .limit(1);

    if (!existingItem || existingItem.character.userId !== user.id) {
      const problem = createProblemDetails({
        status: 404,
        title: 'Progression item not found',
        detail: 'Item does not exist or you do not have access to it.',
      });

      return NextResponse.json(problem, { status: problem.status });
    }

    // Build update object
    const updateData: Partial<CharacterProgressionItem> = {
      updatedAt: new Date(),
    };

    if (parsed.data.completed !== undefined) {
      updateData.completed = parsed.data.completed;
      updateData.completedAt = parsed.data.completed ? new Date() : null;
    }

    if (parsed.data.notes !== undefined) {
      updateData.notes = parsed.data.notes;
    }

    if (parsed.data.orderIndex !== undefined) {
      updateData.orderIndex = parsed.data.orderIndex;
    }

    if (parsed.data.categoryId !== undefined) {
      updateData.categoryId = parsed.data.categoryId;
    }

    const [updatedItem] = await db
      .update(characterProgressionItems)
      .set(updateData)
      .where(eq(characterProgressionItems.id, id))
      .returning();

    return NextResponse.json({
      data: updatedItem,
    });
  } catch (error) {
    const problem = createProblemDetails({
      status: 500,
      title: 'Failed to update progression item',
      detail: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(problem, { status: problem.status });
  }
}

/**
 * DELETE /api/progression/items/[id]
 * Deletes a progression item (requires auth)
 */
export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return unauthorizedResponse();
  }

  const { id } = await context.params;

  try {
    const db = getDbClient();

    // Get the item and verify ownership through character
    const [existingItem] = await db
      .select({
        item: characterProgressionItems,
        character: userCharacters,
      })
      .from(characterProgressionItems)
      .innerJoin(
        userCharacters,
        eq(characterProgressionItems.userCharacterId, userCharacters.id)
      )
      .where(eq(characterProgressionItems.id, id))
      .limit(1);

    if (!existingItem || existingItem.character.userId !== user.id) {
      const problem = createProblemDetails({
        status: 404,
        title: 'Progression item not found',
        detail: 'Item does not exist or you do not have access to it.',
      });

      return NextResponse.json(problem, { status: problem.status });
    }

    await db
      .delete(characterProgressionItems)
      .where(eq(characterProgressionItems.id, id));

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    const problem = createProblemDetails({
      status: 500,
      title: 'Failed to delete progression item',
      detail: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(problem, { status: problem.status });
  }
}
