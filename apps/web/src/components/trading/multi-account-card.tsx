'use client';

import { useEffect, useState } from 'react';

type AggregatedData = {
  totalInvested: number;
  totalBankroll: number;
  totalRealisedPnL: number;
  totalActivePositions: number;
  totalCompletedTrades: number;
  accounts: Array<{
    characterName: string;
    investedValue: number;
    bankroll: number;
    realisedPnL: number;
    activePositions: number;
  }>;
  overallRoi: number | null;
};

function formatGp(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}b`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return value.toLocaleString();
}

export function MultiAccountCard() {
  const [data, setData] = useState<AggregatedData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/ge/multi-account')
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
          <div className="tool-card-icon blue">
            <svg
              fill="none"
              height="18"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
              width="18"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div>
            <div className="tool-card-title">Multi-Account</div>
          </div>
        </div>
        <div className="tool-card-body">
          <div className="tool-skeleton tool-skeleton-line" />
        </div>
      </div>
    );
  }

  if (!data || data.accounts.length <= 1) {
    return (
      <div className="tool-card">
        <div className="tool-card-header">
          <div className="tool-card-icon blue">
            <svg
              fill="none"
              height="18"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
              width="18"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div>
            <div className="tool-card-title">Multi-Account</div>
            <div className="tool-card-subtitle">
              Aggregate across characters
            </div>
          </div>
        </div>
        <div className="tool-card-empty">
          Add multiple tradable characters to see aggregated stats.
        </div>
      </div>
    );
  }

  return (
    <div className="tool-card">
      <div className="tool-card-header">
        <div className="tool-card-icon blue">
          <svg
            fill="none"
            height="18"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
            width="18"
          >
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </div>
        <div>
          <div className="tool-card-title">Multi-Account</div>
          <div className="tool-card-subtitle">
            {data.accounts.length} characters
          </div>
        </div>
      </div>

      <div className="tool-card-body">
        <div className="tool-stat-row">
          <span className="tool-stat-label">Total Invested</span>
          <span className="tool-stat-value">
            {formatGp(data.totalInvested)}
          </span>
        </div>
        <div className="tool-stat-row">
          <span className="tool-stat-label">Total Bankroll</span>
          <span className="tool-stat-value">
            {formatGp(data.totalBankroll)}
          </span>
        </div>
        <div className="tool-stat-row">
          <span className="tool-stat-label">Realised P&amp;L</span>
          <span
            className={`tool-stat-value ${data.totalRealisedPnL >= 0 ? 'positive' : 'negative'}`}
          >
            {data.totalRealisedPnL >= 0 ? '+' : ''}
            {formatGp(data.totalRealisedPnL)}
          </span>
        </div>
        {data.overallRoi !== null && (
          <div className="tool-stat-row">
            <span className="tool-stat-label">Overall ROI</span>
            <span
              className={`tool-stat-value ${data.overallRoi >= 0 ? 'positive' : 'negative'}`}
            >
              {data.overallRoi >= 0 ? '+' : ''}
              {data.overallRoi}%
            </span>
          </div>
        )}

        <div className="multi-account-accounts">
          {data.accounts.map((acc) => (
            <div key={acc.characterName} className="multi-account-row">
              <span className="multi-account-name">{acc.characterName}</span>
              <div className="multi-account-stats">
                <span>{formatGp(acc.bankroll)} bank</span>
                <span>{acc.activePositions} pos</span>
                <span
                  className={acc.realisedPnL >= 0 ? 'positive' : 'negative'}
                  style={{
                    color: acc.realisedPnL >= 0 ? '#4ade80' : '#f87171',
                  }}
                >
                  {acc.realisedPnL >= 0 ? '+' : ''}
                  {formatGp(acc.realisedPnL)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
