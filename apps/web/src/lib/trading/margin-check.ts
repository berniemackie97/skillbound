/**
 * Margin Check Helper
 *
 * In OSRS, the standard way to find an item's true margin is:
 *   1. Buy 1 item at +5% above guide price (instant buy)
 *   2. Sell 1 item at -5% below guide price (instant sell)
 *   3. The difference reveals the actual spread
 *
 * This module calculates true margins from margin-check data,
 * accounts for the 2% GE tax, and determines if a flip is
 * profitable after all costs.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GE_TAX_RATE = 0.02;
const GE_TAX_CAP = 5_000_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MarginCheckInput {
  itemId: number;
  itemName: string;
  /** Price you paid to instant-buy 1 item */
  instantBuyPrice: number;
  /** Price you received when instant-selling 1 item */
  instantSellPrice: number;
  /** Quantity you plan to flip per cycle */
  quantity?: number | undefined;
  /** Item's 4-hour buy limit */
  buyLimit?: number | undefined;
}

export interface MarginCheckResult {
  itemId: number;
  itemName: string;
  instantBuyPrice: number;
  instantSellPrice: number;
  /** Raw margin before tax */
  rawMargin: number;
  /** Tax per item on the sell */
  taxPerItem: number;
  /** Net margin after tax */
  netMargin: number;
  /** Net margin as percentage of buy price */
  netMarginPercent: number;
  /** Whether the flip is profitable after tax */
  profitable: boolean;
  /** Cost of the margin check itself (buy + sell tax loss) */
  marginCheckCost: number;
  /** Projected profit for the given quantity */
  projectedProfit: number | null;
  /** Projected profit for a full buy-limit cycle */
  projectedProfitFullCycle: number | null;
  /** GP/hr estimate assuming 4-hour cycle */
  gpPerHour: number | null;
}

// ---------------------------------------------------------------------------
// Calculation
// ---------------------------------------------------------------------------

/**
 * Calculate the tax on a single sell transaction.
 */
function sellTax(sellPrice: number): number {
  return Math.min(Math.floor(sellPrice * GE_TAX_RATE), GE_TAX_CAP);
}

/**
 * Analyse a margin check and compute profitability.
 */
export function analyzeMarginCheck(input: MarginCheckInput): MarginCheckResult {
  const { instantBuyPrice, instantSellPrice, quantity, buyLimit } = input;

  // The instant buy is always the higher price (what buyers pay)
  // The instant sell is always the lower price (what sellers receive)
  const rawMargin = instantBuyPrice - instantSellPrice;
  const taxPerItem = sellTax(instantBuyPrice);
  const netMargin = rawMargin - taxPerItem;
  const netMarginPercent =
    instantSellPrice > 0
      ? Math.round((netMargin / instantSellPrice) * 10000) / 100
      : 0;

  const profitable = netMargin > 0;

  // Cost of the margin check: you buy 1 at high price, sell 1 at low price
  // Loss = buyPrice - (sellPrice - tax on sell)
  const marginCheckCost =
    instantBuyPrice - instantSellPrice + sellTax(instantSellPrice);

  // Projected profit for given quantity
  const projectedProfit =
    quantity !== undefined && quantity > 0 ? netMargin * quantity : null;

  // Projected profit for full buy limit cycle
  const projectedProfitFullCycle =
    buyLimit !== undefined && buyLimit > 0 ? netMargin * buyLimit : null;

  // GP/hr: full cycle profit / 4 hours
  const gpPerHour =
    projectedProfitFullCycle !== null
      ? Math.round(projectedProfitFullCycle / 4)
      : null;

  return {
    itemId: input.itemId,
    itemName: input.itemName,
    instantBuyPrice,
    instantSellPrice,
    rawMargin,
    taxPerItem,
    netMargin,
    netMarginPercent,
    profitable,
    marginCheckCost,
    projectedProfit,
    projectedProfitFullCycle,
    gpPerHour,
  };
}

/**
 * Compare multiple margin checks to find the best flip.
 * Returns items sorted by GP/hr (or net margin if no buy limit).
 */
export function rankMarginChecks(
  inputs: MarginCheckInput[]
): MarginCheckResult[] {
  const results = inputs.map(analyzeMarginCheck).filter((r) => r.profitable);

  return results.sort((a, b) => {
    // Prefer GP/hr if available
    if (a.gpPerHour !== null && b.gpPerHour !== null) {
      return b.gpPerHour - a.gpPerHour;
    }
    return b.netMargin - a.netMargin;
  });
}
