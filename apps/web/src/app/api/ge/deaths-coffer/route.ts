/**
 * GET /api/ge/deaths-coffer
 *
 * Finds the best items to deposit into Death's Coffer.
 * Death's Coffer accepts items at 105% of GE guide price, so items
 * whose buy price is below the guide price yield a net premium.
 */

import { NextResponse } from 'next/server';

import { logger } from '@/lib/logging/logger';
import {
  findBestCofferItems,
  type CofferItem,
} from '@/lib/trading/deaths-coffer';
import { getGeExchangeItems } from '@/lib/trading/ge-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const items = await getGeExchangeItems();

    // Build coffer inputs: use buyPrice as actual cost, value as guide price
    // (the `value` field is the official GE guide / store price)
    const cofferItems: CofferItem[] = items
      .filter(
        (item) => item.buyPrice !== null && item.buyPrice > 0 && item.value > 0
      )
      .map((item) => ({
        itemId: item.id,
        itemName: item.name,
        buyPrice: item.buyPrice!,
        guidePrice: item.value,
      }));

    const best = findBestCofferItems(cofferItems, 100);

    return NextResponse.json({
      data: best.slice(0, 50),
      meta: {
        itemsScanned: cofferItems.length,
        profitableCount: best.length,
      },
    });
  } catch (error) {
    logger.error({ error }, "Failed to scan Death's Coffer items");
    return NextResponse.json(
      { error: "Failed to scan Death's Coffer items" },
      { status: 500 }
    );
  }
}
