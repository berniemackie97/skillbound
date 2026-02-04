import type { GeTrade } from '@skillbound/database';

/**
 * Trade input for creating a new trade
 */
export interface TradeInput {
  itemId: number;
  itemName: string;
  tradeType: 'buy' | 'sell';
  quantity: number;
  pricePerItem: number;
  tradedAt: Date;
  notes?: string | undefined;
}

/**
 * Result of validating a trade before creation
 */
export interface TradeValidationResult {
  valid: boolean;
  error?: string | undefined;
  errorCode?: string | undefined;
  availableQuantity?: number | undefined;
}

/**
 * Custom error for trade validation failures
 */
export class TradeValidationError extends Error {
  public readonly code: string;
  public readonly availableQuantity: number | undefined;

  constructor(message: string, code: string, availableQuantity?: number) {
    super(message);
    this.name = 'TradeValidationError';
    this.code = code;
    this.availableQuantity = availableQuantity;
  }
}

/**
 * Trade with calculated profit (for sell trades)
 */
export interface TradeWithProfit extends GeTrade {
  matchedBuyTrade?: GeTrade | null;
}

/**
 * Profit summary for a time period
 */
export interface ProfitSummary {
  // Realized P&L (from completed sell trades)
  totalProfit: number;
  totalRevenue: number;
  totalCost: number;
  tradeCount: number;
  profitableTradeCount: number;
  lossTradeCount: number;
  averageProfitPerTrade: number;

  // Unrealized P&L (from inventory positions at current market prices)
  unrealizedProfit: number;
  unrealizedPositions: Array<{
    itemId: number;
    itemName: string;
    iconUrl: string;
    quantity: number;
    costBasis: number; // What we paid
    marketValue: number; // Current market value
    unrealizedPnL: number; // marketValue - costBasis
    currentPrice: number | null; // Current market price per item
  }>;

  // Combined metrics
  totalPnL: number; // realized + unrealized

  // Top flips - complete buy+sell cycles grouped by item
  topFlips: Array<{
    itemId: number;
    itemName: string;
    iconUrl: string;
    profit: number;
    totalBought: number; // Total quantity bought
    totalSold: number; // Total quantity sold (completed)
    flipCount: number; // Number of completed sell trades
    avgBuyPrice: number;
    avgSellPrice: number;
    roi: number; // Return on investment percentage
  }>;
  topLossFlips: Array<{
    itemId: number;
    itemName: string;
    iconUrl: string;
    loss: number;
    totalBought: number;
    totalSold: number;
    flipCount: number;
    avgBuyPrice: number;
    avgSellPrice: number;
    roi: number;
  }>;

  // Legacy fields for backward compatibility
  topProfitableItems: Array<{
    itemId: number;
    itemName: string;
    iconUrl: string;
    profit: number;
    tradeCount: number;
  }>;
  topLossItems: Array<{
    itemId: number;
    itemName: string;
    iconUrl: string;
    loss: number;
    tradeCount: number;
  }>;
}

/**
 * Item profit breakdown
 */
export interface ItemProfitBreakdown {
  itemId: number;
  itemName: string;
  totalBought: number;
  totalSold: number;
  totalSpent: number;
  totalEarned: number;
  netProfit: number;
  averageBuyPrice: number;
  averageSellPrice: number;
  averageMargin: number;
  marginPercent: number;
  tradeHistory: GeTrade[];
}

/**
 * Time period filter options
 */
export type TimePeriod = 'today' | 'week' | 'month' | 'year' | 'all';

/**
 * Result of analyzing the impact of deleting a trade
 */
export interface DeleteTradeImpact {
  trade: {
    id: string;
    itemName: string;
    tradeType: 'buy' | 'sell';
    quantity: number;
    totalValue: number;
  };
  /** For buys: sells that are currently matched to this buy */
  affectedSells: Array<{
    id: string;
    quantity: number;
    tradedAt: Date;
    totalValue: number;
  }>;
  /** For sells: the buy this sell is matched to (if any) */
  matchedBuy: {
    id: string;
    quantity: number;
    tradedAt: Date;
  } | null;
  /** Warning message to show the user */
  warningMessage: string | null;
}

/**
 * Profit match result from FIFO calculation
 */
export interface ProfitMatch {
  buyTradeId: string;
  quantityMatched: number;
  buyPrice: number;
  sellPrice: number;
  profit: number;
}
