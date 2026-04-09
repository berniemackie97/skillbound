/**
 * GET /api/ge/portfolio
 *
 * Authenticated endpoint that analyses the user's active inventory
 * positions for portfolio diversification — HHI, category breakdown,
 * top-3 concentration, and a letter grade.
 */

import { NextResponse } from 'next/server';

import { getSessionUser, unauthorizedResponse } from '@/lib/auth/auth-helpers';
import { getTradableCharacters } from '@/lib/character/character-selection';
import { getGeExchangeItems } from '@/lib/trading/ge-service';
import {
  analyzeDiversification,
  type PortfolioPosition,
} from '@/lib/trading/portfolio-diversification';
import { getInventoryPositions } from '@/lib/trading/trading-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorizedResponse();

  const tradable = await getTradableCharacters(user.id);
  const first = tradable[0];
  if (!first) {
    return NextResponse.json({
      data: analyzeDiversification([]),
    });
  }

  // Get user's current positions and live prices
  const [positions, geItems] = await Promise.all([
    getInventoryPositions(first.id, { onlyWithRemaining: true }),
    getGeExchangeItems(),
  ]);

  // Build a price lookup
  const priceMap = new Map<number, number>();
  for (const item of geItems) {
    if (item.buyPrice !== null) {
      priceMap.set(item.id, item.buyPrice);
    }
  }

  // Map inventory positions to portfolio positions with market values
  const portfolioPositions: PortfolioPosition[] = positions
    .filter((p) => p.remainingQuantity > 0)
    .map((p) => {
      const currentPrice = priceMap.get(p.itemId) ?? p.averageBuyPrice;
      return {
        itemId: p.itemId,
        itemName: p.itemName,
        marketValue: p.remainingQuantity * currentPrice,
      };
    });

  const analysis = analyzeDiversification(portfolioPositions);

  return NextResponse.json(
    {
      data: analysis,
      meta: { characterId: first.id, positionCount: positions.length },
    },
    {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    }
  );
}
