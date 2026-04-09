/**
 * GET /api/ge/fill-time?itemId=X&quantity=Y
 *
 * Estimates how long a buy or sell order will take to fill,
 * factoring in trade volume and the 4-hour GE buy limit.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createProblemDetails } from '@/lib/api/problem-details';
import {
  estimateFlipCycleTime,
  estimateFillTime,
} from '@/lib/trading/fill-time';
import { getGeExchangeItems } from '@/lib/trading/ge-service';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  itemId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().positive().optional(),
  orderType: z.enum(['buy', 'sell']).optional(),
});

export async function GET(request: NextRequest) {
  const raw = {
    itemId: request.nextUrl.searchParams.get('itemId') ?? undefined,
    quantity: request.nextUrl.searchParams.get('quantity') ?? undefined,
    orderType: request.nextUrl.searchParams.get('orderType') ?? undefined,
  };

  const parsed = querySchema.safeParse(raw);
  if (!parsed.success) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid parameters',
      detail:
        'itemId is required (positive integer). quantity and orderType are optional.',
      errors: parsed.error.issues,
      instance: request.nextUrl.pathname,
    });
    return NextResponse.json(problem, { status: problem.status });
  }

  const { itemId, quantity, orderType } = parsed.data;

  try {
    const items = await getGeExchangeItems();
    const item = items.find((i) => i.id === itemId);

    if (!item) {
      return NextResponse.json(
        { error: `Item ${itemId} not found` },
        { status: 404 }
      );
    }

    const hourlyVolume =
      item.volume1h ?? (item.volume5m !== null ? item.volume5m * 12 : null);
    const effectiveQuantity = quantity ?? item.buyLimit ?? 1;

    // If they want a specific order type, give them that
    if (orderType) {
      const estimate = estimateFillTime({
        quantity: effectiveQuantity,
        buyLimit: item.buyLimit,
        hourlyVolume,
        orderType,
      });

      return NextResponse.json({
        data: {
          itemId: item.id,
          itemName: item.name,
          quantity: effectiveQuantity,
          orderType,
          estimate,
        },
      });
    }

    // Default: full flip cycle estimate (buy + sell)
    const cycle = estimateFlipCycleTime(
      effectiveQuantity,
      item.buyLimit,
      hourlyVolume
    );

    return NextResponse.json({
      data: {
        itemId: item.id,
        itemName: item.name,
        quantity: effectiveQuantity,
        buyLimit: item.buyLimit,
        hourlyVolume,
        cycle,
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to estimate fill time' },
      { status: 500 }
    );
  }
}
