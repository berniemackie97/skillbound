'use client';

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

export function TradingOverview({ overview }: TradingOverviewProps) {
  return (
    <div className="trading-overview">
      <div className="overview-grid">
        <div className="overview-card highlight">
          <span className="label">Total Profit</span>
          <span
            className={`value large ${overview.totalProfit >= 0 ? 'positive' : 'negative'}`}
          >
            {overview.totalProfit >= 0 ? '+' : ''}
            {formatGp(overview.totalProfit)} GP
          </span>
        </div>

        <div className="overview-card">
          <span className="label">Total Volume</span>
          <span className="value">{formatGp(overview.totalVolume)} GP</span>
        </div>

        <div className="overview-card">
          <span className="label">Total Trades</span>
          <span className="value">{overview.totalTrades}</span>
        </div>

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
          <span className="label">Avg Trade Size</span>
          <span className="value">
            {formatGp(Math.round(overview.averageTradeValue))} GP
          </span>
        </div>

        <div className="overview-card">
          <span className="label">Avg Profit/Trade</span>
          <span
            className={`value ${overview.averageProfitPerTrade >= 0 ? 'positive' : 'negative'}`}
          >
            {overview.averageProfitPerTrade >= 0 ? '+' : ''}
            {formatGp(Math.round(overview.averageProfitPerTrade))} GP
          </span>
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
  );
}
