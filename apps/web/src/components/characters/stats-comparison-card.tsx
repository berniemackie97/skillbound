'use client';

import { useState } from 'react';

interface StatData {
  label: string;
  current: number;
  previous?: number;
  format?: 'number' | 'xp' | 'level';
}

interface StatsComparisonCardProps {
  title: string;
  stats: StatData[];
  showDeltas?: boolean;
}

function formatValue(value: number, format: StatData['format'] = 'number'): string {
  if (format === 'xp') {
    if (value >= 1_000_000_000) {
      return `${(value / 1_000_000_000).toFixed(2)}B`;
    }
    if (value >= 1_000_000) {
      return `${(value / 1_000_000).toFixed(2)}M`;
    }
    if (value >= 1_000) {
      return `${(value / 1_000).toFixed(1)}K`;
    }
  }
  return value.toLocaleString();
}

function formatDelta(current: number, previous: number | undefined, format: StatData['format'] = 'number'): string | null {
  if (previous === undefined) return null;
  const delta = current - previous;
  if (delta === 0) return null;
  const sign = delta > 0 ? '+' : '';
  return `${sign}${formatValue(delta, format)}`;
}

export function StatsComparisonCard({
  title,
  stats,
  showDeltas = true,
}: StatsComparisonCardProps) {
  const [hoveredStat, setHoveredStat] = useState<string | null>(null);

  return (
    <div className="stats-comparison-card">
      <h3>{title}</h3>
      <div className="stats-list">
        {stats.map((stat) => {
          const delta = showDeltas ? formatDelta(stat.current, stat.previous, stat.format) : null;
          const isPositive = stat.previous !== undefined && stat.current > stat.previous;
          const isNegative = stat.previous !== undefined && stat.current < stat.previous;

          return (
            <div
              key={stat.label}
              className={`stat-item ${hoveredStat === stat.label ? 'hovered' : ''}`}
              onMouseEnter={() => setHoveredStat(stat.label)}
              onMouseLeave={() => setHoveredStat(null)}
            >
              <span className="stat-label">{stat.label}</span>
              <div className="stat-values">
                <strong className="stat-current">
                  {formatValue(stat.current, stat.format)}
                </strong>
                {delta && (
                  <span
                    className={`stat-delta ${isPositive ? 'positive' : ''} ${isNegative ? 'negative' : ''}`}
                  >
                    {delta}
                  </span>
                )}
              </div>
              {hoveredStat === stat.label && stat.previous !== undefined && (
                <div className="stat-tooltip">
                  <span>Previous: {formatValue(stat.previous, stat.format)}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
