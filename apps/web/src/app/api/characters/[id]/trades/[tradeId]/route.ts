import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createProblemDetails } from '@/lib/api/problem-details';
import { getSessionUser, unauthorizedResponse } from '@/lib/auth/auth-helpers';
import {
  deleteTrade,
  getDeleteTradeImpact,
  getTrade,
  updateTrade,
  verifyCharacterOwnership,
} from '@/lib/trading/trading-service';

const paramsSchema = z.object({
  id: z.string().uuid(),
  tradeId: z.string().uuid(),
});

type RouteParams = Promise<{ id?: string; tradeId?: string }>;

const updateTradeSchema = z.object({
  itemId: z.number().int().positive().optional(),
  itemName: z.string().min(1).max(255).optional(),
  quantity: z.number().int().positive().optional(),
  pricePerItem: z.number().int().nonnegative().optional(),
  tradedAt: z.string().datetime().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

/**
 * GET /api/characters/[id]/trades/[tradeId]
 *
 * Get a specific trade by ID
 *
 * Query params:
 * - includeDeleteImpact: if "true", also returns the impact of deleting this trade
 */
export async function GET(
  request: NextRequest,
  { params }: { params: RouteParams }
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
      title: 'Invalid parameters',
      detail: 'Character id and trade id must be valid UUIDs.',
      errors: parsedParams.error.issues,
    });
    return NextResponse.json(problem, { status: problem.status });
  }

  const { id: characterId, tradeId } = parsedParams.data;

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

  try {
    const trade = await getTrade(characterId, tradeId);

    if (!trade) {
      const problem = createProblemDetails({
        status: 404,
        title: 'Trade not found',
        detail: 'No trade exists with that id.',
      });
      return NextResponse.json(problem, { status: problem.status });
    }

    // Check if delete impact is requested
    const includeDeleteImpact =
      request.nextUrl.searchParams.get('includeDeleteImpact') === 'true';

    if (includeDeleteImpact) {
      const deleteImpact = await getDeleteTradeImpact(characterId, tradeId);
      return NextResponse.json({ data: trade, deleteImpact });
    }

    return NextResponse.json({ data: trade });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    const problem = createProblemDetails({
      status: 500,
      title: 'Failed to get trade',
      detail: errorMessage,
    });
    return NextResponse.json(problem, { status: problem.status });
  }
}

/**
 * PATCH /api/characters/[id]/trades/[tradeId]
 *
 * Update a trade
 *
 * Body:
 * {
 *   itemId?: number,
 *   itemName?: string,
 *   quantity?: number,
 *   pricePerItem?: number,
 *   tradedAt?: string (ISO date),
 *   notes?: string | null
 * }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: RouteParams }
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
      title: 'Invalid parameters',
      detail: 'Character id and trade id must be valid UUIDs.',
      errors: parsedParams.error.issues,
    });
    return NextResponse.json(problem, { status: problem.status });
  }

  const { id: characterId, tradeId } = parsedParams.data;

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

  const parsed = updateTradeSchema.safeParse(body);
  if (!parsed.success) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid update data',
      detail: 'Check the update values.',
      errors: parsed.error.issues,
    });
    return NextResponse.json(problem, { status: problem.status });
  }

  if (Object.keys(parsed.data).length === 0) {
    const problem = createProblemDetails({
      status: 400,
      title: 'No updates provided',
      detail: 'Provide at least one field to update.',
    });
    return NextResponse.json(problem, { status: problem.status });
  }

  try {
    // Build update object only with defined values to satisfy exactOptionalPropertyTypes
    const updateData: Parameters<typeof updateTrade>[2] = {};
    if (parsed.data.itemId !== undefined)
      updateData.itemId = parsed.data.itemId;
    if (parsed.data.itemName !== undefined)
      updateData.itemName = parsed.data.itemName;
    if (parsed.data.quantity !== undefined)
      updateData.quantity = parsed.data.quantity;
    if (parsed.data.pricePerItem !== undefined)
      updateData.pricePerItem = parsed.data.pricePerItem;
    if (parsed.data.tradedAt !== undefined)
      updateData.tradedAt = new Date(parsed.data.tradedAt);
    if (parsed.data.notes !== undefined)
      updateData.notes = parsed.data.notes ?? undefined;

    const updated = await updateTrade(characterId, tradeId, updateData);

    if (!updated) {
      const problem = createProblemDetails({
        status: 404,
        title: 'Trade not found',
        detail: 'No trade exists with that id.',
      });
      return NextResponse.json(problem, { status: problem.status });
    }

    return NextResponse.json({ data: updated });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    const problem = createProblemDetails({
      status: 500,
      title: 'Failed to update trade',
      detail: errorMessage,
    });
    return NextResponse.json(problem, { status: problem.status });
  }
}

/**
 * DELETE /api/characters/[id]/trades/[tradeId]
 *
 * Delete a trade
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: RouteParams }
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
      title: 'Invalid parameters',
      detail: 'Character id and trade id must be valid UUIDs.',
      errors: parsedParams.error.issues,
    });
    return NextResponse.json(problem, { status: problem.status });
  }

  const { id: characterId, tradeId } = parsedParams.data;

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

  try {
    const result = await deleteTrade(characterId, tradeId);

    if (!result.success) {
      const problem = createProblemDetails({
        status: 404,
        title: 'Trade not found',
        detail: 'No trade exists with that id.',
      });
      return NextResponse.json(problem, { status: problem.status });
    }

    return NextResponse.json({
      data: { deleted: true, deletedCount: result.deletedCount },
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    const problem = createProblemDetails({
      status: 500,
      title: 'Failed to delete trade',
      detail: errorMessage,
    });
    return NextResponse.json(problem, { status: problem.status });
  }
}
