/**
 * POST /api/ge/margin-check
 *
 * Analyses margin-check data (instant buy + instant sell prices)
 * to determine true margins, profitability after 2% GE tax,
 * and projected GP/hr for a flip cycle.
 *
 * Accepts a single item or a batch for comparison ranking.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createProblemDetails } from '@/lib/api/problem-details';
import {
  analyzeMarginCheck,
  rankMarginChecks,
  type MarginCheckInput,
} from '@/lib/trading/margin-check';

export const dynamic = 'force-dynamic';

const singleSchema = z.object({
  itemId: z.number().int().positive(),
  itemName: z.string().min(1),
  instantBuyPrice: z.number().positive(),
  instantSellPrice: z.number().positive(),
  quantity: z.number().int().positive().optional(),
  buyLimit: z.number().int().positive().optional(),
});

const batchSchema = z.object({
  items: z.array(singleSchema).min(1).max(50),
});

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();

    // Try batch first, then single
    const batchParsed = batchSchema.safeParse(body);
    if (batchParsed.success) {
      const ranked = rankMarginChecks(
        batchParsed.data.items as MarginCheckInput[]
      );
      return NextResponse.json({
        data: ranked,
        meta: {
          inputCount: batchParsed.data.items.length,
          profitableCount: ranked.length,
        },
      });
    }

    const singleParsed = singleSchema.safeParse(body);
    if (singleParsed.success) {
      const result = analyzeMarginCheck(singleParsed.data as MarginCheckInput);
      return NextResponse.json({ data: result });
    }

    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid margin check data',
      detail:
        'Provide a single item { itemId, itemName, instantBuyPrice, instantSellPrice } or { items: [...] } for batch.',
      errors: singleParsed.error.issues,
      instance: request.nextUrl.pathname,
    });
    return NextResponse.json(problem, { status: problem.status });
  } catch {
    return NextResponse.json(
      { error: 'Failed to process margin check' },
      { status: 500 }
    );
  }
}
