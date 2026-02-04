import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionUser, unauthorizedResponse } from '@/lib/auth/auth-helpers';
import { createProblemDetails } from '@/lib/api/problem-details';
import {
  getBankroll,
  setBankroll,
  verifyCharacterOwnership,
} from '@/lib/trading/trading-service';

const paramsSchema = z.object({
  id: z.string().uuid(),
});

const updateBankrollSchema = z.object({
  currentBankroll: z.number().int().nonnegative(),
  initialBankroll: z.number().int().nonnegative().optional(),
});

/**
 * GET /api/characters/[id]/bankroll
 *
 * Get the trading bankroll/liquidity for a character
 */
export async function GET(
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
    const bankroll = await getBankroll(characterId);
    return NextResponse.json({
      data: bankroll ?? {
        currentBankroll: 0,
        initialBankroll: 0,
      },
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    const problem = createProblemDetails({
      status: 500,
      title: 'Failed to get bankroll',
      detail: errorMessage,
    });
    return NextResponse.json(problem, { status: problem.status });
  }
}

/**
 * PUT /api/characters/[id]/bankroll
 *
 * Set or update the trading bankroll for a character
 *
 * Body:
 * {
 *   currentBankroll: number,
 *   initialBankroll?: number
 * }
 */
export async function PUT(
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

  const parsed = updateBankrollSchema.safeParse(body);
  if (!parsed.success) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid bankroll data',
      detail: 'Check the bankroll input values.',
      errors: parsed.error.issues,
    });
    return NextResponse.json(problem, { status: problem.status });
  }

  try {
    const bankroll = await setBankroll(characterId, {
      currentBankroll: parsed.data.currentBankroll,
      initialBankroll: parsed.data.initialBankroll,
    });

    return NextResponse.json({ data: bankroll });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    const problem = createProblemDetails({
      status: 500,
      title: 'Failed to update bankroll',
      detail: errorMessage,
    });
    return NextResponse.json(problem, { status: problem.status });
  }
}
