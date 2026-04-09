'use client';

import { useEffect, useState } from 'react';

type RiskData = {
  tradeCount: number;
  winRate: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number | null;
  expectancy: number;
  maxDrawdown: number;
  maxDrawdownPercent: number | null;
  sharpeRatio: number | null;
  sortinoRatio: number | null;
  longestWinStreak: number;
  longestLossStreak: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  summary: string;
};

function formatGp(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return value.toLocaleString();
}

export function RiskMetricsCard() {
  const [data, setData] = useState<RiskData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/ge/risk-metrics')
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.data) setData(json.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="tool-card">
        <div className="tool-card-header">
          <div className="tool-card-icon gold">
            <svg
              fill="none"
              height="18"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
              width="18"
            >
              <path d="M3 3v18h18" />
              <path d="M18 17V9" />
              <path d="M13 17V5" />
              <path d="M8 17v-3" />
            </svg>
          </div>
          <div>
            <div className="tool-card-title">Risk Metrics</div>
          </div>
        </div>
        <div className="tool-card-body">
          <div className="tool-skeleton tool-skeleton-line medium" />
          <div className="tool-skeleton tool-skeleton-line short" />
          <div className="tool-skeleton tool-skeleton-line" />
        </div>
      </div>
    );
  }

  if (!data || data.tradeCount === 0) {
    return (
      <div className="tool-card">
        <div className="tool-card-header">
          <div className="tool-card-icon gold">
            <svg
              fill="none"
              height="18"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
              width="18"
            >
              <path d="M3 3v18h18" />
              <path d="M18 17V9" />
              <path d="M13 17V5" />
              <path d="M8 17v-3" />
            </svg>
          </div>
          <div>
            <div className="tool-card-title">Risk Metrics</div>
            <div className="tool-card-subtitle">
              Strategy performance analysis
            </div>
          </div>
        </div>
        <div className="tool-card-empty">
          Complete some trades to see your risk metrics.
        </div>
      </div>
    );
  }

  return (
    <div className="tool-card">
      <div className="tool-card-header">
        <div className="tool-card-icon gold">
          <svg
            fill="none"
            height="18"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
            width="18"
          >
            <path d="M3 3v18h18" />
            <path d="M18 17V9" />
            <path d="M13 17V5" />
            <path d="M8 17v-3" />
          </svg>
        </div>
        <div>
          <div className="tool-card-title">Risk Metrics</div>
          <div className="tool-card-subtitle">
            {data.tradeCount} trades analysed
          </div>
        </div>
      </div>

      <div className="tool-card-body">
        <div className="risk-hero">
          <div className={`grade-badge large grade-${data.grade}`}>
            {data.grade}
          </div>
          <div className="risk-hero-text">
            <div className="risk-hero-summary">{data.summary}</div>
          </div>
        </div>

        <div className="risk-metrics-grid">
          <div className="risk-metric-cell">
            <span className="label">Win Rate</span>
            <span className="value">{Math.round(data.winRate * 100)}%</span>
          </div>
          <div className="risk-metric-cell">
            <span className="label">Profit Factor</span>
            <span className="value">
              {data.profitFactor === null
                ? '—'
                : data.profitFactor === Infinity
                  ? '∞'
                  : data.profitFactor.toFixed(2)}
            </span>
          </div>
          <div className="risk-metric-cell">
            <span className="label">Expectancy</span>
            <span
              className={`value ${data.expectancy >= 0 ? 'positive' : 'negative'}`}
            >
              {data.expectancy >= 0 ? '+' : ''}
              {formatGp(data.expectancy)}
            </span>
          </div>
          <div className="risk-metric-cell">
            <span className="label">Max DD</span>
            <span className="value">{formatGp(data.maxDrawdown)}</span>
          </div>
          <div className="risk-metric-cell">
            <span className="label">Sharpe</span>
            <span className="value">{data.sharpeRatio?.toFixed(2) ?? '—'}</span>
          </div>
          <div className="risk-metric-cell">
            <span className="label">Best Streak</span>
            <span className="value">
              {data.longestWinStreak}W / {data.longestLossStreak}L
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
