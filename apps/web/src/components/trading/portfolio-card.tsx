'use client';

import { useEffect, useState } from 'react';

type CategoryAllocation = {
  category: string;
  label: string;
  value: number;
  percent: number;
  itemCount: number;
};

type DiversificationData = {
  totalValue: number;
  uniqueItems: number;
  hhi: number;
  topThreeConcentration: number;
  categories: CategoryAllocation[];
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  summary: string;
};

const CATEGORY_COLORS: Record<string, string> = {
  'melee-weapon': '#d4af37',
  'ranged-weapon': '#3a9bcf',
  'magic-weapon': '#a855f7',
  'melee-armour': '#ef4444',
  'ranged-armour': '#22c55e',
  'magic-armour': '#06b6d4',
  'skilling-supply': '#f97316',
  'food-potion': '#ec4899',
  'rune-ammo': '#8b5cf6',
  'rare-cosmetic': '#f4d03f',
  resource: '#7faf3a',
  other: '#a89372',
};

function formatGp(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}b`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return value.toLocaleString();
}

export function PortfolioCard() {
  const [data, setData] = useState<DiversificationData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/ge/portfolio')
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
              <circle cx="12" cy="12" r="10" />
              <path d="M12 2a10 10 0 0 1 0 20" />
              <path d="M12 2v20" />
            </svg>
          </div>
          <div>
            <div className="tool-card-title">Portfolio</div>
          </div>
        </div>
        <div className="tool-card-body">
          <div className="tool-skeleton tool-skeleton-line medium" />
          <div className="tool-skeleton tool-skeleton-line short" />
        </div>
      </div>
    );
  }

  if (!data || data.uniqueItems === 0) {
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
              <circle cx="12" cy="12" r="10" />
              <path d="M12 2a10 10 0 0 1 0 20" />
              <path d="M12 2v20" />
            </svg>
          </div>
          <div>
            <div className="tool-card-title">Portfolio Diversification</div>
            <div className="tool-card-subtitle">
              Category & concentration analysis
            </div>
          </div>
        </div>
        <div className="tool-card-empty">
          Hold some inventory positions to see your portfolio breakdown.
        </div>
      </div>
    );
  }

  const topCategories = data.categories.slice(0, 6);

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
            <circle cx="12" cy="12" r="10" />
            <path d="M12 2a10 10 0 0 1 0 20" />
            <path d="M12 2v20" />
          </svg>
        </div>
        <div>
          <div className="tool-card-title">Portfolio Diversification</div>
          <div className="tool-card-subtitle">
            {data.uniqueItems} items &middot; {formatGp(data.totalValue)} GP
            total
          </div>
        </div>
        <div className={`grade-badge grade-${data.grade}`}>{data.grade}</div>
      </div>

      <div className="tool-card-body">
        <div className="tool-stat-row">
          <span className="tool-stat-label">Top 3 Concentration</span>
          <span className="tool-stat-value">{data.topThreeConcentration}%</span>
        </div>
        <div className="tool-stat-row">
          <span className="tool-stat-label">HHI Score</span>
          <span className="tool-stat-value">{data.hhi.toLocaleString()}</span>
        </div>

        <div className="portfolio-legend">
          {topCategories.map((cat) => (
            <div key={cat.category} className="portfolio-legend-item">
              <span
                className="portfolio-legend-dot"
                style={{
                  background: CATEGORY_COLORS[cat.category] ?? '#a89372',
                }}
              />
              <span className="portfolio-legend-label">{cat.label}</span>
              <span className="portfolio-legend-pct">{cat.percent}%</span>
            </div>
          ))}
        </div>

        <div
          style={{
            fontSize: '0.78rem',
            color: 'var(--text-muted)',
            lineHeight: 1.4,
          }}
        >
          {data.summary}
        </div>
      </div>
    </div>
  );
}
