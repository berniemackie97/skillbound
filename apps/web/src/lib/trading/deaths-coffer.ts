/**
 * Death's Coffer Value Analysis
 *
 * Death's Coffer in OSRS accepts items at 105% of their GE guide price.
 * This creates an opportunity: items whose GE buy price is significantly
 * below the guide price can be bought and deposited for a net profit
 * (in terms of death-cost savings).
 *
 * This module identifies the best items to deposit into Death's Coffer
 * by calculating the effective value premium.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Death's Coffer accepts items at 105% of GE guide price.
 * The guide price is the "official" mid-price (average of buy/sell).
 */
const COFFER_MULTIPLIER = 1.05;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CofferItem {
  itemId: number;
  itemName: string;
  /** Instant buy price on the GE */
  buyPrice: number;
  /** GE guide / mid price */
  guidePrice: number;
}

export interface CofferAnalysis {
  itemId: number;
  itemName: string;
  buyPrice: number;
  guidePrice: number;
  /** Value Death's Coffer credits for this item */
  cofferValue: number;
  /** Profit per item deposited (cofferValue - buyPrice) */
  profitPerItem: number;
  /** ROI percentage */
  roi: number;
}

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

/**
 * Calculate the Death's Coffer value for a single item.
 */
export function calculateCofferValue(guidePrice: number): number {
  return Math.floor(guidePrice * COFFER_MULTIPLIER);
}

/**
 * Analyse an item for Death's Coffer profitability.
 * Returns null if the item is not profitable to deposit.
 */
export function analyzeCofferItem(item: CofferItem): CofferAnalysis | null {
  const cofferValue = calculateCofferValue(item.guidePrice);
  const profitPerItem = cofferValue - item.buyPrice;

  if (profitPerItem <= 0) return null;

  const roi =
    item.buyPrice > 0
      ? Math.round((profitPerItem / item.buyPrice) * 10000) / 100
      : 0;

  return {
    itemId: item.itemId,
    itemName: item.itemName,
    buyPrice: item.buyPrice,
    guidePrice: item.guidePrice,
    cofferValue,
    profitPerItem,
    roi,
  };
}

/**
 * Find the best items to deposit into Death's Coffer.
 * Returns items sorted by profit per item (descending).
 *
 * @param items - Array of items with buy and guide prices
 * @param minProfit - Minimum profit per item to include (default 100 gp)
 */
export function findBestCofferItems(
  items: CofferItem[],
  minProfit: number = 100
): CofferAnalysis[] {
  const results: CofferAnalysis[] = [];

  for (const item of items) {
    const analysis = analyzeCofferItem(item);
    if (analysis && analysis.profitPerItem >= minProfit) {
      results.push(analysis);
    }
  }

  return results.sort((a, b) => b.profitPerItem - a.profitPerItem);
}

/**
 * Calculate total coffer value for a batch of items.
 * Useful for estimating how many death-costs a deposit covers.
 */
export function calculateBatchCofferValue(
  items: Array<{ guidePrice: number; quantity: number }>
): number {
  return items.reduce(
    (total, item) =>
      total + calculateCofferValue(item.guidePrice) * item.quantity,
    0
  );
}
