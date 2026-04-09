/**
 * GET /api/ge/multi-account
 *
 * Authenticated endpoint that aggregates trading data across all of
 * a user's tradable characters, with overlap detection.
 */

import { NextResponse } from 'next/server';

import { getSessionUser, unauthorizedResponse } from '@/lib/auth/auth-helpers';
import { getTradableCharacters } from '@/lib/character/character-selection';
import {
  aggregateAccounts,
  findOverlappingItems,
  type AccountSummary,
} from '@/lib/trading/multi-account';
import {
  getBankroll,
  getInventoryPositions,
  getCharacterTrades,
} from '@/lib/trading/trading-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorizedResponse();

  const tradable = await getTradableCharacters(user.id);
  if (tradable.length === 0) {
    return NextResponse.json({
      data: aggregateAccounts([]),
      meta: { overlappingItems: [] },
    });
  }

  // Fetch data for all tradable characters in parallel
  const accountData = await Promise.all(
    tradable.map(async (char) => {
      const [bankroll, positions, sellResult] = await Promise.all([
        getBankroll(char.id),
        getInventoryPositions(char.id, { onlyWithRemaining: true }),
        getCharacterTrades(char.id, { tradeType: 'sell', limit: 5000 }),
      ]);

      const investedValue = positions.reduce(
        (sum, p) => sum + p.remainingQuantity * p.averageBuyPrice,
        0
      );
      const realisedPnL = sellResult.trades.reduce(
        (sum, t) => sum + (t.totalProfit ?? 0),
        0
      );

      const summary: AccountSummary = {
        characterId: char.id,
        characterName: char.displayName ?? char.id,
        investedValue,
        bankroll: bankroll?.currentBankroll ?? 0,
        realisedPnL,
        activePositions: positions.length,
        completedTrades: sellResult.total,
      };

      return {
        summary,
        items: positions.map((p) => ({
          itemId: p.itemId,
          itemName: p.itemName,
        })),
      };
    })
  );

  const summaries = accountData.map((d) => d.summary);
  const aggregated = aggregateAccounts(summaries);

  const overlappingItems = findOverlappingItems(
    accountData.map((d) => ({
      characterName: d.summary.characterName,
      items: d.items,
    }))
  );

  return NextResponse.json(
    {
      data: aggregated,
      meta: { overlappingItems },
    },
    {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    }
  );
}
