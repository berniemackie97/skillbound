import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionUser, unauthorizedResponse } from '@/lib/auth/auth-helpers';
import { createProblemDetails } from '@/lib/api/problem-details';
import {
  getInventoryPositions,
  getInventorySummary,
  recalculateInventoryPositions,
  verifyCharacterOwnership,
} from '@/lib/trading/trading-service';

const paramsSchema = z.object({
  id: z.string().uuid(),
});

const querySchema = z.object({
  summary: z.string().optional(),
  onlyWithRemaining: z.string().optional(),
  itemId: z.coerce.number().int().positive().optional(),
});

/**
 * GET /api/characters/[id]/inventory
 *
 * Get inventory positions for a character (items currently held)
 *
 * Query parameters:
 * - summary: If "true", return inventory summary instead of full positions
 * - onlyWithRemaining: If "true", only return positions with remaining quantity > 0
 * - itemId: Filter by specific item ID
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

  const searchParams = request.nextUrl.searchParams;
  const parsedQuery = querySchema.safeParse({
    summary: searchParams.get('summary') ?? undefined,
    onlyWithRemaining: searchParams.get('onlyWithRemaining') ?? undefined,
    itemId: searchParams.get('itemId') ?? undefined,
  });

  if (!parsedQuery.success) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid query parameters',
      detail: 'Check query parameter values.',
      errors: parsedQuery.error.issues,
    });
    return NextResponse.json(problem, { status: problem.status });
  }

  try {
    // Return summary if requested
    if (parsedQuery.data.summary === 'true') {
      const summary = await getInventorySummary(characterId);
      return NextResponse.json({ data: summary });
    }

    // Get inventory positions
    const positions = await getInventoryPositions(characterId, {
      onlyWithRemaining: parsedQuery.data.onlyWithRemaining === 'true',
      itemId: parsedQuery.data.itemId,
    });

    return NextResponse.json({ data: positions });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    const problem = createProblemDetails({
      status: 500,
      title: 'Failed to get inventory',
      detail: errorMessage,
    });
    return NextResponse.json(problem, { status: problem.status });
  }
}

/**
 * POST /api/characters/[id]/inventory
 *
 * Recalculate inventory positions from trade history
 * Useful if positions get out of sync
 */
export async function POST(
  _request: NextRequest,
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

  try {
    const result = await recalculateInventoryPositions(characterId);
    return NextResponse.json({
      data: result,
      message: `Recalculated ${result.positionsUpdated} inventory positions`,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    const problem = createProblemDetails({
      status: 500,
      title: 'Failed to recalculate inventory',
      detail: errorMessage,
    });
    return NextResponse.json(problem, { status: problem.status });
  }
}
