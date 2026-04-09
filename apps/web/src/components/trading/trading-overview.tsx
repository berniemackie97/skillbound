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

export function TradingOverview({
  overview,
  summary,
  periodLabel,
}: TradingOverviewProps) {
  const winRate =
    summary.tradeCount > 0
      ? Math.round((summary.profitableTradeCount / summary.tradeCount) * 100)
      : 0;
  const pnlClass = summary.totalPnL >= 0 ? 'positive' : 'negative';
  const unrealizedClass =
    summary.unrealizedProfit >= 0 ? 'positive' : 'negative';

  return (
    <div className="trading-snapshot">
      <div className="snapshot-period">{periodLabel}</div>
      <div className="snapshot-stats">
        <div className="snapshot-stat snapshot-stat--hero">
          <span className="snapshot-label">Total P&amp;L</span>
          <span className={`snapshot-value ${pnlClass}`}>
            {summary.totalPnL >= 0 ? '+' : ''}
            {formatGp(summary.totalPnL)}
          </span>
          <span className={`snapshot-sub ${unrealizedClass}`}>
            {summary.unrealizedProfit >= 0 ? '+' : ''}
            {formatGp(summary.unrealizedProfit)} unrealized
          </span>
        </div>
        <div className="snapshot-stat">
          <span className="snapshot-label">Trades</span>
          <span className="snapshot-value">{summary.tradeCount}</span>
        </div>
        <div className="snapshot-stat">
          <span className="snapshot-label">Win Rate</span>
          <span className="snapshot-value">{winRate}%</span>
        </div>
        <div className="snapshot-stat">
          <span className="snapshot-label">Volume</span>
          <span className="snapshot-value">
            {formatGp(overview.totalVolume)}
          </span>
        </div>
        <div className="snapshot-stat">
          <span className="snapshot-label">Open Positions</span>
          <span className="snapshot-value">
            {summary.unrealizedPositions.length}
          </span>
        </div>
      </div>
    </div>
  );
}
