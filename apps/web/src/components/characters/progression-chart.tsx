'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface ProgressionDataPoint {
  timestamp: string;
  totalXp: number;
  totalLevel: number;
  combatLevel: number;
}

interface ProgressionChartProps {
  data: ProgressionDataPoint[];
  metric?: 'totalXp' | 'totalLevel' | 'combatLevel' | 'all';
}

const COLORS = {
  totalXp: '#d4af37',
  totalLevel: '#6bb6ff',
  combatLevel: '#94db97',
};

const LABELS = {
  totalXp: 'Total XP',
  totalLevel: 'Total Level',
  combatLevel: 'Combat Level',
};

function formatXpValue(value: number): string {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(0)}K`;
  }
  return value.toLocaleString();
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function ProgressionChart({
  data,
  metric = 'all',
}: ProgressionChartProps) {
  if (data.length === 0) {
    return (
      <div className="chart-empty">
        <p>No progression data available yet.</p>
      </div>
    );
  }

  const showAll = metric === 'all';

  return (
    <div className="chart-container large">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={160}>
        <AreaChart
          data={data}
          margin={{ top: 8, right: 8, left: -10, bottom: 0 }}
        >
          <defs>
            <linearGradient id="gradientXp" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLORS.totalXp} stopOpacity={0.3} />
              <stop offset="95%" stopColor={COLORS.totalXp} stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="gradientLevel" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLORS.totalLevel} stopOpacity={0.3} />
              <stop offset="95%" stopColor={COLORS.totalLevel} stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="gradientCombat" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLORS.combatLevel} stopOpacity={0.3} />
              <stop offset="95%" stopColor={COLORS.combatLevel} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(226, 176, 101, 0.08)"
            vertical={false}
          />
          <XAxis
            dataKey="timestamp"
            tickFormatter={formatTimestamp}
            stroke="var(--text-muted)"
            tick={{ fontSize: 9 }}
            tickLine={false}
            axisLine={{ stroke: 'rgba(226, 176, 101, 0.15)' }}
            interval="preserveStartEnd"
          />
          <YAxis
            stroke="var(--text-muted)"
            tick={{ fontSize: 9 }}
            tickFormatter={formatXpValue}
            tickLine={false}
            axisLine={false}
            width={50}
          />
          <Tooltip
            cursor={{ stroke: 'rgba(212, 175, 55, 0.3)', strokeWidth: 1 }}
            contentStyle={{
              backgroundColor: 'rgba(30, 25, 18, 0.95)',
              border: '1px solid rgba(226, 176, 101, 0.3)',
              borderRadius: '8px',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
              fontSize: '0.85rem',
            }}
            labelStyle={{ color: 'var(--text-muted)', marginBottom: 8 }}
            itemStyle={{ padding: '2px 0' }}
            formatter={(value, name) => {
              const numValue = typeof value === 'number' ? value : 0;
              const strName = String(name);
              return [
                formatXpValue(numValue),
                LABELS[strName as keyof typeof LABELS] || strName,
              ];
            }}
            labelFormatter={(label) => formatTimestamp(String(label))}
          />
          {showAll && (
            <Legend
              wrapperStyle={{ paddingTop: 8, fontSize: 11 }}
              formatter={(value) => (
                <span style={{ color: 'var(--text)', fontSize: 11 }}>
                  {LABELS[value as keyof typeof LABELS] || value}
                </span>
              )}
            />
          )}
          {(showAll || metric === 'totalXp') && (
            <Area
              type="monotone"
              dataKey="totalXp"
              stroke={COLORS.totalXp}
              strokeWidth={2}
              fill="url(#gradientXp)"
              name="totalXp"
              dot={false}
              activeDot={{
                r: 4,
                fill: COLORS.totalXp,
                stroke: 'rgba(30, 25, 18, 0.95)',
                strokeWidth: 2,
              }}
            />
          )}
          {(showAll || metric === 'totalLevel') && (
            <Area
              type="monotone"
              dataKey="totalLevel"
              stroke={COLORS.totalLevel}
              strokeWidth={2}
              fill="url(#gradientLevel)"
              name="totalLevel"
              dot={false}
              activeDot={{
                r: 4,
                fill: COLORS.totalLevel,
                stroke: 'rgba(30, 25, 18, 0.95)',
                strokeWidth: 2,
              }}
            />
          )}
          {(showAll || metric === 'combatLevel') && (
            <Area
              type="monotone"
              dataKey="combatLevel"
              stroke={COLORS.combatLevel}
              strokeWidth={2}
              fill="url(#gradientCombat)"
              name="combatLevel"
              dot={false}
              activeDot={{
                r: 4,
                fill: COLORS.combatLevel,
                stroke: 'rgba(30, 25, 18, 0.95)',
                strokeWidth: 2,
              }}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
