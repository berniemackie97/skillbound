'use client';

import { useState } from 'react';

type UnrealizedPosition = {
  itemId: number;
  itemName: string;
  iconUrl: string;
  quantity: number;
  costBasis: number;
  marketValue: number;
  unrealizedPnL: number;
  currentPrice: number | null;
};

type FlipData = {
  itemId: number;
  itemName: string;
  iconUrl: string;
  profit: number;
  totalBought: number;
  totalSold: number;
  flipCount: number;
  avgBuyPrice: number;
  avgSellPrice: number;
  roi: number;
};

type LossFlipData = {
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
};

type ProfitSummaryProps = {
  summary: {
    // Realized P&L
    totalProfit: number;
    totalRevenue: number;
    totalCost: number;
    tradeCount: number;
    profitableTradeCount: number;
    lossTradeCount: number;
    averageProfitPerTrade: number;

    // Unrealized P&L
    unrealizedProfit: number;
    unrealizedPositions: UnrealizedPosition[];
    totalPnL: number;

    // Legacy (kept for backward compatibility)
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

    // New flip data (complete buy+sell cycles)
    topFlips: FlipData[];
    topLossFlips: LossFlipData[];
  };
};

function formatGp(value: number): string {
  const absValue = Math.abs(value);
  if (absValue >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)}b`;
  }
  if (absValue >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}m`;
  }
  if (absValue >= 1_000) {
    return `${(value / 1_000).toFixed(1)}k`;
  }
  return value.toLocaleString();
}

export function ProfitSummary({ summary }: ProfitSummaryProps) {
  const [showUnrealizedDetails, setShowUnrealizedDetails] = useState(false);

  const winRate =
    summary.tradeCount > 0
      ? Math.round((summary.profitableTradeCount / summary.tradeCount) * 100)
      : 0;

  const hasUnrealized =
    summary.unrealizedPositions && summary.unrealizedPositions.length > 0;

  return (
    <div className="profit-summary">
      {/* Total P&L Hero Card */}
      <div className="profit-hero">
        <div className="profit-hero-main">
          <span className="label">Total P&L</span>
          <span
            className={`value ${summary.totalPnL >= 0 ? 'positive' : 'negative'}`}
          >
            {summary.totalPnL >= 0 ? '+' : ''}
            {formatGp(summary.totalPnL)} GP
          </span>
        </div>
        <div className="profit-hero-breakdown">
          <div className="profit-breakdown-item">
            <span className="breakdown-label">Realized</span>
            <span
              className={`breakdown-value ${summary.totalProfit >= 0 ? 'positive' : 'negative'}`}
            >
              {summary.totalProfit >= 0 ? '+' : ''}
              {formatGp(summary.totalProfit)}
            </span>
          </div>
          <div className="profit-breakdown-divider" />
          <div className="profit-breakdown-item">
            <span className="breakdown-label">Unrealized</span>
            <span
              className={`breakdown-value ${summary.unrealizedProfit >= 0 ? 'positive' : 'negative'}`}
            >
              {summary.unrealizedProfit >= 0 ? '+' : ''}
              {formatGp(summary.unrealizedProfit)}
            </span>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="profit-cards">
        <div className="profit-card">
          <span className="label">Revenue</span>
          <span className="value">{formatGp(summary.totalRevenue)} GP</span>
        </div>

        <div className="profit-card">
          <span className="label">Expenses</span>
          <span className="value cost">{formatGp(summary.totalCost)} GP</span>
        </div>

        <div className="profit-card">
          <span className="label">Trades</span>
          <span className="value">{summary.tradeCount}</span>
        </div>

        <div className="profit-card">
          <span className="label">Win Rate</span>
          <span className="value">{winRate}%</span>
        </div>

        <div className="profit-card">
          <span className="label">Avg Profit/Trade</span>
          <span
            className={`value ${summary.averageProfitPerTrade >= 0 ? 'positive' : 'negative'}`}
          >
            {formatGp(Math.round(summary.averageProfitPerTrade))} GP
          </span>
        </div>
      </div>

      {/* Unrealized Positions Section */}
      {hasUnrealized && (
        <div className="unrealized-section">
          <button
            className="unrealized-toggle"
            onClick={() => setShowUnrealizedDetails(!showUnrealizedDetails)}
            type="button"
          >
            <span className="unrealized-toggle-label">
              Open Positions ({summary.unrealizedPositions.length})
            </span>
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={`unrealized-toggle-icon ${showUnrealizedDetails ? 'open' : ''}`}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {showUnrealizedDetails && (
            <div className="unrealized-positions">
              {summary.unrealizedPositions.slice(0, 10).map((pos) => (
                <div key={pos.itemId} className="unrealized-position">
                  {pos.iconUrl && (
                    <img
                      src={pos.iconUrl}
                      alt=""
                      className="unrealized-item-icon"
                      width={24}
                      height={24}
                      loading="lazy"
                    />
                  )}
                  <div className="unrealized-position-info">
                    <span className="unrealized-position-name">
                      {pos.itemName}
                    </span>
                    <span className="unrealized-position-qty">
                      x{pos.quantity.toLocaleString()}
                    </span>
                  </div>
                  <div className="unrealized-position-values">
                    <span className="unrealized-position-cost">
                      Cost: {formatGp(pos.costBasis)}
                    </span>
                    <span
                      className={`unrealized-position-pnl ${pos.unrealizedPnL >= 0 ? 'positive' : 'negative'}`}
                    >
                      {pos.unrealizedPnL >= 0 ? '+' : ''}
                      {formatGp(pos.unrealizedPnL)}
                    </span>
                  </div>
                </div>
              ))}
              {summary.unrealizedPositions.length > 10 && (
                <div className="unrealized-more">
                  +{summary.unrealizedPositions.length - 10} more positions
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Top Flips Lists */}
      <div className="profit-lists">
        {summary.topFlips.length > 0 && (
          <div className="profit-list">
            <h4>Top Flips</h4>
            <ul>
              {summary.topFlips.map((flip) => (
                <li key={flip.itemId} className="flip-item">
                  <div className="flip-header">
                    {flip.iconUrl && (
                      <img
                        src={flip.iconUrl}
                        alt=""
                        className="item-icon"
                        width={24}
                        height={24}
                        loading="lazy"
                      />
                    )}
                    <div className="flip-info">
                      <span className="item-name">{flip.itemName}</span>
                      <div className="flip-stats">
                        <span className="flip-count">
                          {flip.flipCount} flip{flip.flipCount !== 1 ? 's' : ''}
                        </span>
                        <span className="flip-prices">
                          {formatGp(flip.avgBuyPrice)} → {formatGp(flip.avgSellPrice)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flip-results">
                    <span className="item-profit positive">
                      +{formatGp(flip.profit)}
                    </span>
                    <span
                      className={`flip-roi ${flip.roi >= 0 ? 'positive' : 'negative'}`}
                    >
                      {flip.roi >= 0 ? '+' : ''}
                      {flip.roi.toFixed(1)}%
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {summary.topLossFlips.length > 0 && (
          <div className="profit-list">
            <h4>Worst Flips</h4>
            <ul>
              {summary.topLossFlips.map((flip) => (
                <li key={flip.itemId} className="flip-item">
                  <div className="flip-header">
                    {flip.iconUrl && (
                      <img
                        src={flip.iconUrl}
                        alt=""
                        className="item-icon"
                        width={24}
                        height={24}
                        loading="lazy"
                      />
                    )}
                    <div className="flip-info">
                      <span className="item-name">{flip.itemName}</span>
                      <div className="flip-stats">
                        <span className="flip-count">
                          {flip.flipCount} flip{flip.flipCount !== 1 ? 's' : ''}
                        </span>
                        <span className="flip-prices">
                          {formatGp(flip.avgBuyPrice)} → {formatGp(flip.avgSellPrice)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flip-results">
                    <span className="item-profit negative">
                      -{formatGp(flip.loss)}
                    </span>
                    <span className="flip-roi negative">
                      {flip.roi.toFixed(1)}%
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
