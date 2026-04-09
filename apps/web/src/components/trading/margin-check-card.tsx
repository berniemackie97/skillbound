'use client';

import { useState } from 'react';

type MarginResult = {
  itemId: number;
  itemName: string;
  rawMargin: number;
  taxPerItem: number;
  netMargin: number;
  netMarginPercent: number;
  profitable: boolean;
  marginCheckCost: number;
  projectedProfitFullCycle: number | null;
  gpPerHour: number | null;
};

function formatGp(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return value.toLocaleString();
}

export function MarginCheckCard() {
  const [itemName, setItemName] = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [buyLimit, setBuyLimit] = useState('');
  const [result, setResult] = useState<MarginResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCheck() {
    const bp = parseInt(buyPrice, 10);
    const sp = parseInt(sellPrice, 10);
    if (isNaN(bp) || isNaN(sp) || bp <= 0 || sp <= 0) return;

    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        itemId: 1,
        itemName: itemName || 'Unknown Item',
        instantBuyPrice: bp,
        instantSellPrice: sp,
      };
      const bl = parseInt(buyLimit, 10);
      if (!isNaN(bl) && bl > 0) body['buyLimit'] = bl;

      const res = await fetch('/api/ge/margin-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const json = await res.json();
        setResult(json.data);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
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
            <path d="M9 14l6-6" />
            <circle cx="9.5" cy="8.5" fill="currentColor" r="1.5" />
            <circle cx="14.5" cy="13.5" fill="currentColor" r="1.5" />
            <rect height="20" rx="5" width="20" x="2" y="2" />
          </svg>
        </div>
        <div>
          <div className="tool-card-title">Margin Check</div>
          <div className="tool-card-subtitle">True margin after 2% GE tax</div>
        </div>
      </div>

      <div className="tool-card-body">
        <div className="margin-form">
          <div>
            <label>Item Name</label>
            <input
              placeholder="e.g. Abyssal whip"
              type="text"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
            />
          </div>
          <div className="margin-form-row">
            <div>
              <label>Instant Buy</label>
              <input
                placeholder="High price"
                type="number"
                value={buyPrice}
                onChange={(e) => setBuyPrice(e.target.value)}
              />
            </div>
            <div>
              <label>Instant Sell</label>
              <input
                placeholder="Low price"
                type="number"
                value={sellPrice}
                onChange={(e) => setSellPrice(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label>Buy Limit (optional)</label>
            <input
              placeholder="4h buy limit"
              type="number"
              value={buyLimit}
              onChange={(e) => setBuyLimit(e.target.value)}
            />
          </div>
          <button
            className="button small"
            disabled={loading || !buyPrice || !sellPrice}
            type="button"
            onClick={handleCheck}
          >
            {loading ? 'Checking...' : 'Check Margin'}
          </button>
        </div>

        {result && (
          <div className="margin-result">
            <div className="margin-result-hero">
              <div
                className={`net-margin ${result.profitable ? 'positive' : 'negative'}`}
              >
                {result.netMargin >= 0 ? '+' : ''}
                {formatGp(result.netMargin)} GP
              </div>
              <div className="verdict">
                {result.profitable
                  ? `Profitable flip (${result.netMarginPercent}% margin)`
                  : 'Not profitable after tax'}
              </div>
            </div>
            <div className="tool-stat-row">
              <span className="tool-stat-label">Raw Margin</span>
              <span className="tool-stat-value">
                {formatGp(result.rawMargin)}
              </span>
            </div>
            <div className="tool-stat-row">
              <span className="tool-stat-label">Tax per Item</span>
              <span className="tool-stat-value negative">
                -{formatGp(result.taxPerItem)}
              </span>
            </div>
            <div className="tool-stat-row">
              <span className="tool-stat-label">Check Cost</span>
              <span className="tool-stat-value negative">
                -{formatGp(result.marginCheckCost)}
              </span>
            </div>
            {result.projectedProfitFullCycle !== null && (
              <div className="tool-stat-row">
                <span className="tool-stat-label">Full Cycle Profit</span>
                <span
                  className={`tool-stat-value ${result.projectedProfitFullCycle >= 0 ? 'positive' : 'negative'}`}
                >
                  {formatGp(result.projectedProfitFullCycle)}
                </span>
              </div>
            )}
            {result.gpPerHour !== null && (
              <div className="tool-stat-row">
                <span className="tool-stat-label">GP/hr</span>
                <span
                  className={`tool-stat-value ${result.gpPerHour >= 0 ? 'positive' : 'negative'}`}
                >
                  {formatGp(result.gpPerHour)}/hr
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
