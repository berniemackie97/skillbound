/**
 * Multi-Account Aggregation
 *
 * Aggregates trading data across multiple characters owned by the
 * same user. Useful for users who trade on multiple accounts
 * (e.g., a main, an iron, and a pure).
 *
 * This module provides pure aggregation functions — data fetching
 * is handled at the API layer.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AccountSummary {
  characterId: string;
  characterName: string;
  /** Total GP invested (positions at cost) */
  investedValue: number;
  /** Current bankroll (liquid GP) */
  bankroll: number;
  /** Realised P&L */
  realisedPnL: number;
  /** Number of active trades */
  activePositions: number;
  /** Number of completed trades */
  completedTrades: number;
}

export interface AggregatedSummary {
  /** Total across all accounts */
  totalInvested: number;
  totalBankroll: number;
  totalRealisedPnL: number;
  totalActivePositions: number;
  totalCompletedTrades: number;
  /** Per-account breakdowns */
  accounts: AccountSummary[];
  /** Which account has the highest invested value */
  largestAccount: string | null;
  /** Overall ROI across all accounts */
  overallRoi: number | null;
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

/**
 * Aggregate trading summaries across multiple accounts.
 */
export function aggregateAccounts(
  accounts: AccountSummary[]
): AggregatedSummary {
  if (accounts.length === 0) {
    return {
      totalInvested: 0,
      totalBankroll: 0,
      totalRealisedPnL: 0,
      totalActivePositions: 0,
      totalCompletedTrades: 0,
      accounts: [],
      largestAccount: null,
      overallRoi: null,
    };
  }

  const totalInvested = accounts.reduce((s, a) => s + a.investedValue, 0);
  const totalBankroll = accounts.reduce((s, a) => s + a.bankroll, 0);
  const totalRealisedPnL = accounts.reduce((s, a) => s + a.realisedPnL, 0);
  const totalActivePositions = accounts.reduce(
    (s, a) => s + a.activePositions,
    0
  );
  const totalCompletedTrades = accounts.reduce(
    (s, a) => s + a.completedTrades,
    0
  );

  // Largest account by invested value
  const sorted = [...accounts].sort(
    (a, b) => b.investedValue - a.investedValue
  );
  const largestAccount = sorted[0]!.characterName;

  // Overall ROI: total P&L / total invested (if any)
  const overallRoi =
    totalInvested > 0
      ? Math.round((totalRealisedPnL / totalInvested) * 10000) / 100
      : null;

  return {
    totalInvested,
    totalBankroll,
    totalRealisedPnL,
    totalActivePositions,
    totalCompletedTrades,
    accounts,
    largestAccount,
    overallRoi,
  };
}

/**
 * Find items being traded on multiple accounts (potential overlap/conflict).
 */
export function findOverlappingItems(
  accountPositions: Array<{
    characterName: string;
    items: Array<{ itemId: number; itemName: string }>;
  }>
): Array<{
  itemId: number;
  itemName: string;
  accounts: string[];
}> {
  const itemMap = new Map<
    number,
    { itemName: string; accounts: Set<string> }
  >();

  for (const account of accountPositions) {
    for (const item of account.items) {
      const existing = itemMap.get(item.itemId);
      if (existing) {
        existing.accounts.add(account.characterName);
      } else {
        itemMap.set(item.itemId, {
          itemName: item.itemName,
          accounts: new Set([account.characterName]),
        });
      }
    }
  }

  return [...itemMap.entries()]
    .filter(([, data]) => data.accounts.size > 1)
    .map(([itemId, data]) => ({
      itemId,
      itemName: data.itemName,
      accounts: [...data.accounts],
    }));
}
