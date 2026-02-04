import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionUser, unauthorizedResponse } from '@/lib/auth/auth-helpers';
import { createProblemDetails } from '@/lib/api/problem-details';
import {
  addWatchItem,
  getWatchList,
  removeWatchItem,
  updateWatchItem,
  verifyCharacterOwnership,
} from '@/lib/trading/trading-service';

const paramsSchema = z.object({
  id: z.string().uuid(),
});

const addWatchSchema = z.object({
  itemId: z.number().int().positive(),
  itemName: z.string().min(1).max(255),
  alertOnMargin: z.number().int().nonnegative().optional(),
  alertOnBuyPrice: z.number().int().nonnegative().optional(),
  alertOnSellPrice: z.number().int().nonnegative().optional(),
  alertOnVolume: z.number().int().nonnegative().optional(),
  notes: z.string().max(500).optional(),
});

const updateWatchSchema = z.object({
  watchItemId: z.string().uuid(),
  alertOnMargin: z.number().int().nonnegative().nullable().optional(),
  alertOnBuyPrice: z.number().int().nonnegative().nullable().optional(),
  alertOnSellPrice: z.number().int().nonnegative().nullable().optional(),
  alertOnVolume: z.number().int().nonnegative().nullable().optional(),
  isActive: z.boolean().optional(),
  notes: z.string().max(500).nullable().optional(),
});

const deleteWatchSchema = z.object({
  watchItemId: z.string().uuid(),
});

/**
 * GET /api/characters/[id]/watchlist
 *
 * Get the watch list for a character
 *
 * Query parameters:
 * - activeOnly: If "false", include inactive items (default true)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id?: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return unauthorizedResponse();
  }

  const resolvedParams = await params;
  const parsedParams = paramsSchema.safeParse(resolvedParams);
  if (!parsedParams.success) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid character id',
      detail: 'Character id must be a valid UUID.',
      errors: parsedParams.error.issues,
    });
    return NextResponse.json(problem, { status: problem.status });
  }

  const characterId = parsedParams.data.id;

  // Verify ownership
  const isOwner = await verifyCharacterOwnership(characterId, user.id);
  if (!isOwner) {
    const problem = createProblemDetails({
      status: 404,
      title: 'Character not found',
      detail: 'No saved character exists for that id.',
    });
    return NextResponse.json(problem, { status: problem.status });
  }

  const activeOnly =
    request.nextUrl.searchParams.get('activeOnly') !== 'false';

  try {
    const watchList = await getWatchList(characterId, activeOnly);
    return NextResponse.json({
      data: watchList,
      meta: { count: watchList.length },
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    const problem = createProblemDetails({
      status: 500,
      title: 'Failed to get watch list',
      detail: errorMessage,
    });
    return NextResponse.json(problem, { status: problem.status });
  }
}

/**
 * POST /api/characters/[id]/watchlist
 *
 * Add an item to the watch list
 *
 * Body:
 * {
 *   itemId: number,
 *   itemName: string,
 *   alertOnMargin?: number,
 *   alertOnBuyPrice?: number,
 *   alertOnSellPrice?: number,
 *   alertOnVolume?: number,
 *   notes?: string
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id?: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return unauthorizedResponse();
  }

  const resolvedParams = await params;
  const parsedParams = paramsSchema.safeParse(resolvedParams);
  if (!parsedParams.success) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid character id',
      detail: 'Character id must be a valid UUID.',
      errors: parsedParams.error.issues,
    });
    return NextResponse.json(problem, { status: problem.status });
  }

  const characterId = parsedParams.data.id;

  // Verify ownership
  const isOwner = await verifyCharacterOwnership(characterId, user.id);
  if (!isOwner) {
    const problem = createProblemDetails({
      status: 404,
      title: 'Character not found',
      detail: 'No saved character exists for that id.',
    });
    return NextResponse.json(problem, { status: problem.status });
  }

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

  const parsed = addWatchSchema.safeParse(body);
  if (!parsed.success) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid watch item data',
      detail: 'Check the input values.',
      errors: parsed.error.issues,
    });
    return NextResponse.json(problem, { status: problem.status });
  }

  try {
    const watchItem = await addWatchItem(characterId, {
      itemId: parsed.data.itemId,
      itemName: parsed.data.itemName,
      alertOnMargin: parsed.data.alertOnMargin,
      alertOnBuyPrice: parsed.data.alertOnBuyPrice,
      alertOnSellPrice: parsed.data.alertOnSellPrice,
      alertOnVolume: parsed.data.alertOnVolume,
      notes: parsed.data.notes,
    });

    return NextResponse.json({ data: watchItem }, { status: 201 });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    const problem = createProblemDetails({
      status: 500,
      title: 'Failed to add watch item',
      detail: errorMessage,
    });
    return NextResponse.json(problem, { status: problem.status });
  }
}

/**
 * PATCH /api/characters/[id]/watchlist
 *
 * Update a watch item
 *
 * Body:
 * {
 *   watchItemId: string,
 *   alertOnMargin?: number | null,
 *   alertOnBuyPrice?: number | null,
 *   alertOnSellPrice?: number | null,
 *   alertOnVolume?: number | null,
 *   isActive?: boolean,
 *   notes?: string | null
 * }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id?: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return unauthorizedResponse();
  }

  const resolvedParams = await params;
  const parsedParams = paramsSchema.safeParse(resolvedParams);
  if (!parsedParams.success) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid character id',
      detail: 'Character id must be a valid UUID.',
      errors: parsedParams.error.issues,
    });
    return NextResponse.json(problem, { status: problem.status });
  }

  const characterId = parsedParams.data.id;

  // Verify ownership
  const isOwner = await verifyCharacterOwnership(characterId, user.id);
  if (!isOwner) {
    const problem = createProblemDetails({
      status: 404,
      title: 'Character not found',
      detail: 'No saved character exists for that id.',
    });
    return NextResponse.json(problem, { status: problem.status });
  }

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

  const parsed = updateWatchSchema.safeParse(body);
  if (!parsed.success) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid update data',
      detail: 'Check the update values.',
      errors: parsed.error.issues,
    });
    return NextResponse.json(problem, { status: problem.status });
  }

  try {
    const updated = await updateWatchItem(characterId, parsed.data.watchItemId, {
      alertOnMargin: parsed.data.alertOnMargin,
      alertOnBuyPrice: parsed.data.alertOnBuyPrice,
      alertOnSellPrice: parsed.data.alertOnSellPrice,
      alertOnVolume: parsed.data.alertOnVolume,
      isActive: parsed.data.isActive,
      notes: parsed.data.notes,
    });

    if (!updated) {
      const problem = createProblemDetails({
        status: 404,
        title: 'Watch item not found',
        detail: 'No watch item exists with that id.',
      });
      return NextResponse.json(problem, { status: problem.status });
    }

    return NextResponse.json({ data: updated });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    const problem = createProblemDetails({
      status: 500,
      title: 'Failed to update watch item',
      detail: errorMessage,
    });
    return NextResponse.json(problem, { status: problem.status });
  }
}

/**
 * DELETE /api/characters/[id]/watchlist
 *
 * Remove an item from the watch list
 *
 * Body:
 * {
 *   watchItemId: string
 * }
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id?: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return unauthorizedResponse();
  }

  const resolvedParams = await params;
  const parsedParams = paramsSchema.safeParse(resolvedParams);
  if (!parsedParams.success) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid character id',
      detail: 'Character id must be a valid UUID.',
      errors: parsedParams.error.issues,
    });
    return NextResponse.json(problem, { status: problem.status });
  }

  const characterId = parsedParams.data.id;

  // Verify ownership
  const isOwner = await verifyCharacterOwnership(characterId, user.id);
  if (!isOwner) {
    const problem = createProblemDetails({
      status: 404,
      title: 'Character not found',
      detail: 'No saved character exists for that id.',
    });
    return NextResponse.json(problem, { status: problem.status });
  }

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

  const parsed = deleteWatchSchema.safeParse(body);
  if (!parsed.success) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid request',
      detail: 'Provide a valid watchItemId.',
      errors: parsed.error.issues,
    });
    return NextResponse.json(problem, { status: problem.status });
  }

  try {
    const deleted = await removeWatchItem(characterId, parsed.data.watchItemId);

    if (!deleted) {
      const problem = createProblemDetails({
        status: 404,
        title: 'Watch item not found',
        detail: 'No watch item exists with that id.',
      });
      return NextResponse.json(problem, { status: problem.status });
    }

    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    const problem = createProblemDetails({
      status: 500,
      title: 'Failed to delete watch item',
      detail: errorMessage,
    });
    return NextResponse.json(problem, { status: problem.status });
  }
}
