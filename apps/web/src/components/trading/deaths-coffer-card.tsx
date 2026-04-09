'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type CofferResult = {
  itemId: number;
  itemName: string;
  buyPrice: number;
  cofferValue: number;
  profitPerItem: number;
  roi: number;
};

function formatGp(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return value.toLocaleString();
}

export function DeathsCofferCard() {
  const [data, setData] = useState<CofferResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/ge/deaths-coffer')
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
          <div className="tool-card-icon red">
            <svg
              fill="none"
              height="18"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
              width="18"
            >
              <path d="M12 2a4 4 0 0 0-4 4c0 2 1 3 2 4l2 2 2-2c1-1 2-2 2-4a4 4 0 0 0-4-4z" />
              <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
            </svg>
          </div>
          <div>
            <div className="tool-card-title">Death&apos;s Coffer</div>
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
        <div className="tool-card-icon red">
          <svg
            fill="none"
            height="18"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
            width="18"
          >
            <path d="M12 2a4 4 0 0 0-4 4c0 2 1 3 2 4l2 2 2-2c1-1 2-2 2-4a4 4 0 0 0-4-4z" />
            <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
          </svg>
        </div>
        <div>
          <div className="tool-card-title">Death&apos;s Coffer</div>
          <div className="tool-card-subtitle">
            Items valued at 105% guide price
          </div>
        </div>
      </div>

      <div className="tool-card-body">
        {data.length === 0 ? (
          <div className="tool-card-empty">
            No profitable coffer items found.
          </div>
        ) : (
          <table className="coffer-table">
            <thead>
              <tr>
                <th>Item</th>
                <th style={{ textAlign: 'right' }}>Buy</th>
                <th style={{ textAlign: 'right' }}>Coffer</th>
                <th style={{ textAlign: 'right' }}>Premium</th>
              </tr>
            </thead>
            <tbody>
              {data.slice(0, 8).map((item) => (
                <tr key={item.itemId}>
                  <td
                    style={{
                      maxWidth: 140,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <Link
                      className="tool-item-link"
                      href={`/trading/item/${item.itemId}`}
                    >
                      {item.itemName}
                    </Link>
                  </td>
                  <td
                    style={{
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {formatGp(item.buyPrice)}
                  </td>
                  <td
                    style={{
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {formatGp(item.cofferValue)}
                  </td>
                  <td
                    style={{
                      textAlign: 'right',
                      fontWeight: 600,
                      color: '#4ade80',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    +{formatGp(item.profitPerItem)}
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
