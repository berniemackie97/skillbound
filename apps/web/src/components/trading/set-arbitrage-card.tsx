'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type ArbResult = {
  setName: string;
  setId: number;
  setPrice: number | null;
  componentsTotalPrice: number | null;
  direction: 'buy-set' | 'buy-parts' | 'none';
  bestProfit: number | null;
};

function formatGp(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return value.toLocaleString();
}

export function SetArbitrageCard() {
  const [data, setData] = useState<ArbResult[]>([]);
  const [meta, setMeta] = useState<{
    setsScanned: number;
    opportunityCount: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/ge/set-arbitrage')
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.data) setData(json.data);
        if (json?.meta) setMeta(json.meta);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="tool-card">
        <div className="tool-card-header">
          <div className="tool-card-icon green">
            <svg
              fill="none"
              height="18"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
              width="18"
            >
              <rect height="14" rx="2" width="20" x="2" y="7" />
              <path d="M16 7V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v3" />
            </svg>
          </div>
          <div>
            <div className="tool-card-title">Set Arbitrage</div>
          </div>
        </div>
        <div className="tool-card-body">
          <div className="tool-skeleton tool-skeleton-line" />
          <div className="tool-skeleton tool-skeleton-line medium" />
        </div>
      </div>
    );
  }

  return (
    <div className="tool-card">
      <div className="tool-card-header">
        <div className="tool-card-icon green">
          <svg
            fill="none"
            height="18"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
            width="18"
          >
            <rect height="14" rx="2" width="20" x="2" y="7" />
            <path d="M16 7V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v3" />
          </svg>
        </div>
        <div>
          <div className="tool-card-title">Set Arbitrage</div>
          <div className="tool-card-subtitle">
            {meta
              ? `${meta.setsScanned} sets scanned`
              : 'Buy set/sell parts for profit'}
          </div>
        </div>
      </div>

      <div className="tool-card-body">
        {data.length === 0 ? (
          <div className="tool-card-empty">
            No profitable set arbitrage opportunities right now.
          </div>
        ) : (
          <table className="arb-table">
            <thead>
              <tr>
                <th>Set</th>
                <th>Direction</th>
                <th style={{ textAlign: 'right' }}>Profit</th>
              </tr>
            </thead>
            <tbody>
              {data.slice(0, 6).map((opp) => (
                <tr key={opp.setId}>
                  <td>
                    <Link
                      className="tool-item-link"
                      href={`/trading/item/${opp.setId}`}
                    >
                      {opp.setName}
                    </Link>
                  </td>
                  <td>
                    <span className={`arb-direction ${opp.direction}`}>
                      {opp.direction === 'buy-set' ? 'Buy Set' : 'Buy Parts'}
                    </span>
                  </td>
                  <td
                    style={{
                      textAlign: 'right',
                      fontWeight: 600,
                      color: '#4ade80',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    +{formatGp(opp.bestProfit ?? 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
