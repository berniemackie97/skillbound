import {
  eq,
  geTradingBankroll,
  geTrades,
  type GeTradingBankroll,
  type NewGeTradingBankroll,
} from '@skillbound/database';

import { getDbClient } from '../db';
import { logger } from '../logging/logger';

/**
 * Get or create bankroll for a character
 */
export async function getBankroll(
  characterId: string
): Promise<GeTradingBankroll | null> {
  const db = getDbClient();

  const [bankroll] = await db
    .select()
    .from(geTradingBankroll)
    .where(eq(geTradingBankroll.userCharacterId, characterId))
    .limit(1);

  return bankroll ?? null;
}

/**
 * Set or update bankroll for a character
 */
export async function setBankroll(
  characterId: string,
  input: {
    currentBankroll: number;
    initialBankroll?: number | undefined;
  }
): Promise<GeTradingBankroll> {
  const db = getDbClient();

  const bankrollData: NewGeTradingBankroll = {
    userCharacterId: characterId,
    currentBankroll: input.currentBankroll,
    initialBankroll: input.initialBankroll ?? input.currentBankroll,
  };

  const [bankroll] = await db
    .insert(geTradingBankroll)
    .values(bankrollData)
    .onConflictDoUpdate({
      target: geTradingBankroll.userCharacterId,
      set: {
        currentBankroll: input.currentBankroll,
        ...(input.initialBankroll !== undefined && {
          initialBankroll: input.initialBankroll,
        }),
        updatedAt: new Date(),
      },
    })
    .returning();

  if (!bankroll) {
    throw new Error('Failed to set bankroll');
  }

  logger.info({ characterId, currentBankroll: input.currentBankroll }, 'Updated bankroll');
  return bankroll;
}

/**
 * Adjust bankroll by a delta amount (positive or negative)
 */
export async function adjustBankroll(
  characterId: string,
  delta: number
): Promise<GeTradingBankroll> {
  // Get current bankroll or create with 0
  const existing = await getBankroll(characterId);
  const currentAmount = existing?.currentBankroll ?? 0;
  const newAmount = currentAmount + delta;

  return setBankroll(characterId, {
    currentBankroll: newAmount,
    initialBankroll: existing?.initialBankroll,
  });
}

/**
 * Recalculate the current bankroll based on initial bankroll and all trades.
 * This is useful to sync bankroll if trades were recorded before bankroll tracking.
 *
 * Formula: currentBankroll = initialBankroll - (total buys) + (total sells)
 */
export async function recalculateBankroll(
  characterId: string
): Promise<GeTradingBankroll> {
  const db = getDbClient();

  // Get existing bankroll to preserve initial value
  const existing = await getBankroll(characterId);
  const initialBankroll = existing?.initialBankroll ?? 0;

  // Get all trades for this character
  const trades = await db
    .select()
    .from(geTrades)
    .where(eq(geTrades.userCharacterId, characterId));

  // Calculate net change from trades
  let netChange = 0;
  for (const trade of trades) {
    if (trade.tradeType === 'buy') {
      // Buys reduce bankroll
      netChange -= trade.totalValue;
    } else {
      // Sells increase bankroll
      netChange += trade.totalValue;
    }
  }

  const newCurrent = initialBankroll + netChange;

  logger.info(
    { characterId, initialBankroll, netChange, newCurrent },
    'Recalculated bankroll from trades'
  );

  return setBankroll(characterId, {
    currentBankroll: newCurrent,
    initialBankroll,
  });
}
