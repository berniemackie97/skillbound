import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionUser, unauthorizedResponse } from '@/lib/auth/auth-helpers';
import { createProblemDetails } from '@/lib/api/problem-details';
import {
  createTrade,
  getCharacterTrades,
  getTradingOverview,
  TradeValidationError,
  verifyCharacterOwnership,
  type TimePeriod,
} from '@/lib/trading/trading-service';

const paramsSchema = z.object({
  id: z.string().uuid(),
});

const createTradeSchema = z.object({
  itemId: z.number().int().positive(),
  itemName: z.string().min(1).max(255),
  tradeType: z.enum(['buy', 'sell']),
  quantity: z.number().int().positive(),
  pricePerItem: z.number().int().nonnegative(),
  tradedAt: z.string().datetime().optional(),
  notes: z.string().max(1000).optional(),
});

const querySchema = z.object({
  period: z.enum(['today', 'week', 'month', 'year', 'all']).optional(),
  itemId: z.coerce.number().int().positive().optional(),
  tradeType: z.enum(['buy', 'sell']).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  overview: z.string().optional(),
  search: z.string().min(1).max(120).optional(),
});

/**
 * GET /api/characters/[id]/trades
 *
 * Get trades for a character with optional filtering
 *
 * Query parameters:
 * - period: Filter by time period (today, week, month, year, all)
 * - itemId: Filter by item ID
 * - tradeType: Filter by trade type (buy, sell)
 * - limit: Number of trades to return (default 50, max 100)
 * - offset: Pagination offset
 * - overview: If "true", return trading overview statistics instead
 * - search: Filter trades by item name
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
    period: searchParams.get('period') ?? undefined,
    itemId: searchParams.get('itemId') ?? undefined,
    tradeType: searchParams.get('tradeType') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
    offset: searchParams.get('offset') ?? undefined,
    overview: searchParams.get('overview') ?? undefined,
    search: searchParams.get('search') ?? undefined,
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
    // Return overview statistics if requested
    if (parsedQuery.data.overview === 'true') {
      const overview = await getTradingOverview(characterId);
      return NextResponse.json({ data: overview });
    }

    // Get trades with filters
    const { trades, total } = await getCharacterTrades(characterId, {
      period: parsedQuery.data.period as TimePeriod | undefined,
      itemId: parsedQuery.data.itemId,
      tradeType: parsedQuery.data.tradeType,
      search: parsedQuery.data.search,
      limit: parsedQuery.data.limit ?? 50,
      offset: parsedQuery.data.offset ?? 0,
    });

    return NextResponse.json({
      data: trades,
      meta: {
        total,
        limit: parsedQuery.data.limit ?? 50,
        offset: parsedQuery.data.offset ?? 0,
      },
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    const problem = createProblemDetails({
      status: 500,
      title: 'Failed to get trades',
      detail: errorMessage,
    });
    return NextResponse.json(problem, { status: problem.status });
  }
}

/**
 * POST /api/characters/[id]/trades
 *
 * Create a new trade for a character
 *
 * Body:
 * {
 *   itemId: number,
 *   itemName: string,
 *   tradeType: "buy" | "sell",
 *   quantity: number,
 *   pricePerItem: number,
 *   tradedAt?: string (ISO date),
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

  const parsed = createTradeSchema.safeParse(body);
  if (!parsed.success) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid trade data',
      detail: 'Check the trade input values.',
      errors: parsed.error.issues,
    });
    return NextResponse.json(problem, { status: problem.status });
  }

  try {
    const trade = await createTrade(characterId, {
      itemId: parsed.data.itemId,
      itemName: parsed.data.itemName,
      tradeType: parsed.data.tradeType,
      quantity: parsed.data.quantity,
      pricePerItem: parsed.data.pricePerItem,
      tradedAt: parsed.data.tradedAt
        ? new Date(parsed.data.tradedAt)
        : new Date(),
      notes: parsed.data.notes,
    });

    return NextResponse.json({ data: trade }, { status: 201 });
  } catch (err) {
    // Handle validation errors with appropriate status codes
    if (err instanceof TradeValidationError) {
      const problem = createProblemDetails({
        status: 422, // Unprocessable Entity - validation failed
        title: 'Trade validation failed',
        detail: err.message,
        errors: [
          {
            code: err.code,
            message: err.message,
            ...(err.availableQuantity !== undefined && {
              availableQuantity: err.availableQuantity,
            }),
            ...(err.availableBankroll !== undefined && {
              availableBankroll: err.availableBankroll,
            }),
          },
        ],
      });
      return NextResponse.json(problem, { status: problem.status });
    }

    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    const problem = createProblemDetails({
      status: 500,
      title: 'Failed to create trade',
      detail: errorMessage,
    });
    return NextResponse.json(problem, { status: problem.status });
  }
}
