import type { ProfitMatch, TimePeriod } from './types';

/**
 * Calculate total value from quantity and price per item
 */
export function calculateTotalValue(
  quantity: number,
  pricePerItem: number
): number {
  return quantity * pricePerItem;
}

/**
 * Calculate profit using FIFO matching
 * Takes available buy trades and matches them with a sell trade
 */
export function calculateFifoProfit(
  availableBuys: Array<{
    tradeId: string;
    remaining: number;
    pricePerItem: number;
  }>,
  sellPricePerItem: number,
  sellQuantity: number
): { profit: number; matches: ProfitMatch[] } {
  const matches: ProfitMatch[] = [];
  let remainingToMatch = sellQuantity;
  let totalProfit = 0;

  for (const buy of availableBuys) {
    if (remainingToMatch <= 0) break;
    if (buy.remaining <= 0) continue;

    const quantityMatched = Math.min(remainingToMatch, buy.remaining);
    const profitPerItem = sellPricePerItem - buy.pricePerItem;
    const profit = profitPerItem * quantityMatched;

    matches.push({
      buyTradeId: buy.tradeId,
      quantityMatched,
      buyPrice: buy.pricePerItem,
      sellPrice: sellPricePerItem,
      profit,
    });

    totalProfit += profit;
    remainingToMatch -= quantityMatched;
  }

  return { profit: totalProfit, matches };
}

/**
 * Format GP value for display with k/m/b suffixes
 */
export function formatGpDisplay(value: number): string {
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (absValue >= 1_000_000_000) {
    return `${sign}${(absValue / 1_000_000_000).toFixed(2)}b`;
  }
  if (absValue >= 1_000_000) {
    return `${sign}${(absValue / 1_000_000).toFixed(2)}m`;
  }
  if (absValue >= 1_000) {
    return `${sign}${(absValue / 1_000).toFixed(1)}k`;
  }
  return value.toLocaleString();
}

/**
 * Get the start date for a time period filter (testable version)
 */
export function getPeriodStartDate(
  period: TimePeriod,
  now: Date = new Date()
): Date | null {
  switch (period) {
    case 'today':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case 'week': {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return weekAgo;
    }
    case 'month': {
      const monthAgo = new Date(now);
      monthAgo.setDate(monthAgo.getDate() - 30);
      return monthAgo;
    }
    case 'year': {
      const yearAgo = new Date(now);
      yearAgo.setDate(yearAgo.getDate() - 365);
      return yearAgo;
    }
    case 'all':
      return null;
  }
}
