import {
  eq,
  geTradingBankroll,
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
