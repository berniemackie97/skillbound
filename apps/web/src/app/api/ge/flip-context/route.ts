/**
 * GET /api/ge/flip-context
 *
 * Authenticated endpoint that returns the user's trading context
 * for the exchange page: bankroll, active character, trade history summary,
 * and current inventory positions.
 *
 * Only returns data for tradable (non-ironman) characters — matching the
 * same restriction the tracker page uses.
 *
 * Used by the "Find Me a Flip" feature and bankroll display.
 */

import { NextResponse } from 'next/server';

import { getSessionUser, unauthorizedResponse } from '@/lib/auth/auth-helpers';
import { getTradableCharacters } from '@/lib/character/character-selection';
import {
  getBankroll,
  getInventoryPositions,
  getTradedItems,
} from '@/lib/trading/trading-service';

export const dynamic = 'force-dynamic';

const EMPTY_RESPONSE = NextResponse.json(
  {
    data: {
      bankroll: null,
      activeCharacterId: null,
      tradeHistory: null,
      inventory: null,
    },
  },
  {
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
  }
);

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return unauthorizedResponse();
  }

  // Use the same tradable-character filter as the tracker page:
  // only non-ironman, non-archived characters can trade.
  const tradable = await getTradableCharacters(user.id);
  if (tradable.length === 0) {
    return EMPTY_RESPONSE;
  }

  // Use the first tradable character (same as tracker default)
  const first = tradable[0];
  if (!first) return EMPTY_RESPONSE;
  const characterId = first.id;

  // Fetch bankroll, trade history, and inventory in parallel
  const [bankroll, tradedItems, inventoryPositions] = await Promise.all([
    getBankroll(characterId),
    getTradedItems(characterId),
    getInventoryPositions(characterId, { onlyWithRemaining: true }),
  ]);

  // Build trade history summary
  const tradeHistory =
    tradedItems.length > 0
      ? {
          frequentItems: tradedItems.slice(0, 20).map((item) => ({
            itemId: item.itemId,
            itemName: item.itemName,
            tradeCount: item.tradeCount,
          })),
          totalFlips: tradedItems.reduce(
            (sum, item) => sum + item.tradeCount,
            0
          ),
        }
      : null;

  // Build inventory summary
  const inventory =
    inventoryPositions.length > 0
      ? inventoryPositions.map((pos) => ({
          itemId: pos.itemId,
          itemName: pos.itemName,
          remainingQuantity: pos.remainingQuantity,
          averageBuyPrice: pos.averageBuyPrice,
        }))
      : null;

  return NextResponse.json(
    {
      data: {
        bankroll: bankroll
          ? {
              current: bankroll.currentBankroll,
              initial: bankroll.initialBankroll,
            }
          : null,
        activeCharacterId: characterId,
        tradeHistory,
        inventory,
      },
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  );
}
