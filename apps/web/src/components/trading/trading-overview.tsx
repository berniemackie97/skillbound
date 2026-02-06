'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

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

type TradingOverviewProps = {
  overview: {
    totalTrades: number;
    buyTrades: number;
    sellTrades: number;
    totalProfit: number;
    totalVolume: number;
    uniqueItems: number;
    oldestTrade: Date | null;
    newestTrade: Date | null;
    watchListCount: number;
    averageTradeValue: number;
    averageProfitPerTrade: number;
  };
  summary: {
    totalProfit: number;
    totalRevenue: number;
    totalCost: number;
    tradeCount: number;
    profitableTradeCount: number;
    lossTradeCount: number;
    averageProfitPerTrade: number;
    unrealizedProfit: number;
    unrealizedPositions: UnrealizedPosition[];
    totalPnL: number;
  };
  periodLabel: string;
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

function formatDate(date: Date | string | number | null | undefined): string {
  if (date == null) return 'Never';

  const d =
    date instanceof Date
      ? date
      : typeof date === 'string' || typeof date === 'number'
        ? new Date(date)
        : null;

  if (!d || Number.isNaN(d.getTime())) return 'Never';

  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function TradingOverview({
  overview,
  summary,
  periodLabel,
}: TradingOverviewProps) {
  const [showUnrealizedDetails, setShowUnrealizedDetails] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const winRate =
    summary.tradeCount > 0
      ? Math.round((summary.profitableTradeCount / summary.tradeCount) * 100)
      : 0;
  const hasUnrealized =
    summary.unrealizedPositions && summary.unrealizedPositions.length > 0;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(max-width: 640px), (max-height: 520px)');
    const handleChange = () => {
      const compact = media.matches;
      setIsCompact(compact);
      setDetailsOpen(!compact);
    };
    handleChange();
    if (media.addEventListener) {
      media.addEventListener('change', handleChange);
      return () => media.removeEventListener('change', handleChange);
    }
    media.addListener(handleChange);
    return () => media.removeListener(handleChange);
  }, []);

  return (
    <div className="trading-overview">
      <div className="overview-header">
        <div>
          <span className="overview-eyebrow">Trading overview</span>
          <h3 className="overview-title">Performance snapshot</h3>
        </div>
        <span className="overview-period">{periodLabel}</span>
      </div>

      <div className="profit-summary overview-profit">
        <div className="profit-hero">
          <div className="profit-hero-main">
            <span className="label">Total P&amp;L</span>
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

        <div className="overview-section overview-highlights">
          <div className="overview-section-title">Highlights</div>
          <div className="overview-grid overview-quick-grid">
            <div className="overview-card highlight">
              <span className="label">Trades</span>
              <span className="value">{summary.tradeCount}</span>
            </div>
            <div className="overview-card highlight">
              <span className="label">Win Rate</span>
              <span className="value">{winRate}%</span>
            </div>
            <div className="overview-card">
              <span className="label">Avg Profit/Trade</span>
              <span
                className={`value ${summary.averageProfitPerTrade >= 0 ? 'positive' : 'negative'}`}
              >
                {formatGp(Math.round(summary.averageProfitPerTrade))} GP
              </span>
            </div>
            <div className="overview-card">
              <span className="label">Total Volume</span>
              <span className="value">{formatGp(overview.totalVolume)} GP</span>
            </div>
          </div>
        </div>

        {hasUnrealized && (
          <div className="unrealized-section">
            <button
              className="unrealized-toggle"
              type="button"
              onClick={() => setShowUnrealizedDetails(!showUnrealizedDetails)}
            >
              <span className="unrealized-toggle-label">
                Open Positions ({summary.unrealizedPositions.length})
              </span>
              <svg
                className={`unrealized-toggle-icon ${showUnrealizedDetails ? 'open' : ''}`}
                fill="none"
                height="16"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
                width="16"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>

            {showUnrealizedDetails && (
              <div className="unrealized-positions">
                {summary.unrealizedPositions.slice(0, 10).map((pos) => (
                  <div key={pos.itemId} className="unrealized-position">
                    {pos.iconUrl && (
                      <Image
                        alt=""
                        className="unrealized-item-icon"
                        height={24}
                        loading="lazy"
                        src={pos.iconUrl}
                        width={24}
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
      </div>

      <details
        className={`overview-details ${detailsOpen ? 'open' : ''}`}
        open={detailsOpen}
        onToggle={(event) => {
          if (isCompact) {
            setDetailsOpen((event.target as HTMLDetailsElement).open);
          }
        }}
      >
        <summary className="overview-summary">
          <span className="summary-label">More stats</span>
          <span className="summary-meta">
            {overview.uniqueItems} items · {overview.watchListCount} watching
          </span>
          <svg
            aria-hidden="true"
            className="summary-icon"
            fill="none"
            height="16"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
            width="16"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </summary>

        <div className="overview-details-content">
          <div className="overview-section">
            <div className="overview-section-title">Revenue &amp; costs</div>
            <div className="overview-grid">
              <div className="overview-card">
                <span className="label">Revenue</span>
                <span className="value">
                  {formatGp(summary.totalRevenue)} GP
                </span>
              </div>

              <div className="overview-card">
                <span className="label">Expenses</span>
                <span className="value negative">
                  {formatGp(summary.totalCost)} GP
                </span>
              </div>

              <div className="overview-card">
                <span className="label">Avg Trade Size</span>
                <span className="value">
                  {formatGp(Math.round(overview.averageTradeValue))} GP
                </span>
              </div>
            </div>
          </div>

          <div className="overview-section">
            <div className="overview-section-title">Activity &amp; scale</div>
            <div className="overview-grid">
              <div className="overview-card">
                <span className="label">Buys / Sells</span>
                <span className="value">
                  <span className="buy">{overview.buyTrades}</span>
                  {' / '}
                  <span className="sell">{overview.sellTrades}</span>
                </span>
              </div>

              <div className="overview-card">
                <span className="label">Unique Items</span>
                <span className="value">{overview.uniqueItems}</span>
              </div>

              <div className="overview-card">
                <span className="label">Watching</span>
                <span className="value">{overview.watchListCount} items</span>
              </div>

              <div className="overview-card">
                <span className="label">First Trade</span>
                <span className="value small">
                  {formatDate(overview.oldestTrade)}
                </span>
              </div>

              <div className="overview-card">
                <span className="label">Last Trade</span>
                <span className="value small">
                  {formatDate(overview.newestTrade)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </details>
    </div>
  );
}
