import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createProblemDetails } from '@/lib/api/problem-details';
import { getSessionUser, unauthorizedResponse } from '@/lib/auth/auth-helpers';
import {
  getDailyProfitData,
  getItemProfitBreakdown,
  getProfitSummary,
  getTradedItems,
  recalculateProfitMatches,
  verifyCharacterOwnership,
  type TimePeriod,
} from '@/lib/trading/trading-service';

const paramsSchema = z.object({
  id: z.string().uuid(),
});

type RouteParams = Promise<{ id?: string }>;

const querySchema = z.object({
  period: z.enum(['today', 'week', 'month', 'year', 'all']).optional(),
  itemId: z.coerce.number().int().positive().optional(),
  dailyData: z.string().optional(),
  days: z.coerce.number().int().min(1).max(365).optional(),
  items: z.string().optional(),
  recalculate: z.string().optional(),
});

/**
 * GET /api/characters/[id]/trades/profit
 *
 * Get profit summary and analysis for a character
 *
 * Query parameters:
 * - period: Filter by time period (today, week, month, year, all)
 * - itemId: Get profit breakdown for a specific item
 * - dailyData: If "true", return daily profit data for charts
 * - days: Number of days for daily data (default 30, max 365)
 * - items: If "true", return list of traded items
 * - recalculate: If "true", recalculate all profit matches
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
    period: searchParams.get('period') ?? undefined,
    itemId: searchParams.get('itemId') ?? undefined,
    dailyData: searchParams.get('dailyData') ?? undefined,
    days: searchParams.get('days') ?? undefined,
    items: searchParams.get('items') ?? undefined,
    recalculate: searchParams.get('recalculate') ?? undefined,
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
    // Recalculate profit matches if requested
    if (parsedQuery.data.recalculate === 'true') {
      const result = await recalculateProfitMatches(characterId);
      return NextResponse.json({
        data: {
          recalculated: true,
          matchesUpdated: result.matchesUpdated,
        },
      });
    }

    // Return list of traded items if requested
    if (parsedQuery.data.items === 'true') {
      const items = await getTradedItems(characterId);
      return NextResponse.json({ data: items });
    }

    // Return daily profit data for charts if requested
    if (parsedQuery.data.dailyData === 'true') {
      const days = parsedQuery.data.days ?? 30;
      const dailyData = await getDailyProfitData(characterId, days);
      return NextResponse.json({ data: dailyData });
    }

    // Return item-specific breakdown if itemId provided
    if (parsedQuery.data.itemId !== undefined) {
      const breakdown = await getItemProfitBreakdown(
        characterId,
        parsedQuery.data.itemId
      );

      if (!breakdown) {
        const problem = createProblemDetails({
          status: 404,
          title: 'Item not found',
          detail: 'No trades found for that item.',
        });
        return NextResponse.json(problem, { status: problem.status });
      }

      return NextResponse.json({ data: breakdown });
    }

    // Return overall profit summary
    const summary = await getProfitSummary(
      characterId,
      (parsedQuery.data.period as TimePeriod) ?? 'all'
    );

    return NextResponse.json({ data: summary });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    const problem = createProblemDetails({
      status: 500,
      title: 'Failed to get profit data',
      detail: errorMessage,
    });
    return NextResponse.json(problem, { status: problem.status });
  }
}
