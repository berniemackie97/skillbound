/**
 * GET /api/ge/set-arbitrage
 *
 * Scans all known OSRS item sets (Barrows, GWD, Rune, Dragon) for
 * arbitrage opportunities — buying a set and selling individual pieces
 * (or vice versa) for profit.
 */

import { NextResponse } from 'next/server';

import { logger } from '@/lib/logging/logger';
import { getGeExchangeItems } from '@/lib/trading/ge-service';
import { scanSetArbitrage, ITEM_SETS } from '@/lib/trading/item-sets';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const items = await getGeExchangeItems();

    // Build a price map: itemId -> buy price (instant buy / high price)
    const prices = new Map<number, number | null>();
    for (const item of items) {
      prices.set(item.id, item.buyPrice);
    }

    const opportunities = scanSetArbitrage(prices);

    return NextResponse.json({
      data: opportunities.map((opp) => ({
        setName: opp.set.setName,
        setId: opp.set.setId,
        setPrice: opp.setPrice,
        componentsTotalPrice: opp.componentsTotalPrice,
        direction: opp.direction,
        bestProfit: opp.bestProfit,
        profitBuySet: opp.profitBuySet,
        profitBuyParts: opp.profitBuyParts,
        components: opp.set.components,
      })),
      meta: {
        setsScanned: ITEM_SETS.length,
        opportunityCount: opportunities.length,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to scan set arbitrage');
    return NextResponse.json(
      { error: 'Failed to scan set arbitrage opportunities' },
      { status: 500 }
    );
  }
}
