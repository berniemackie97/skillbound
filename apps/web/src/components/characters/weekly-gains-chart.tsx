'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface WeeklySkillGain {
  name: string;
  deltaXp: number;
  deltaLevel: number;
}

interface WeeklyGainsChartProps {
  gains: WeeklySkillGain[];
  maxItems?: number;
}

function formatXp(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(0)}K`;
  }
  return value.toLocaleString();
}

export function WeeklyGainsChart({ gains, maxItems = 10 }: WeeklyGainsChartProps) {
  if (gains.length === 0) {
    return (
      <div className="chart-empty">
        <p>Capture a full week of snapshots to see gains.</p>
      </div>
    );
  }

  const chartData = gains.slice(0, maxItems).map((skill) => ({
    name: skill.name,
    xp: skill.deltaXp,
    levels: skill.deltaLevel,
  }));

  return (
    <div className="chart-container large">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={160}>
        <BarChart
          data={chartData}
          margin={{ top: 8, right: 8, left: -10, bottom: 5 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(226, 176, 101, 0.08)"
            vertical={false}
          />
          <XAxis
            dataKey="name"
            stroke="var(--text-muted)"
            tick={{ fontSize: 9 }}
            tickLine={false}
            axisLine={{ stroke: 'rgba(226, 176, 101, 0.15)' }}
            interval={0}
            height={24}
          />
          <YAxis
            stroke="var(--text-muted)"
            tick={{ fontSize: 9 }}
            tickFormatter={formatXp}
            tickLine={false}
            axisLine={false}
            width={45}
          />
          <Tooltip
            cursor={{ fill: 'rgba(212, 175, 55, 0.1)' }}
            contentStyle={{
              backgroundColor: 'rgba(30, 25, 18, 0.95)',
              border: '1px solid rgba(226, 176, 101, 0.3)',
              borderRadius: '8px',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
              fontSize: '0.85rem',
            }}
            labelStyle={{ color: 'var(--text)', fontWeight: 600, marginBottom: 4 }}
            formatter={(value, name) => {
              const numValue = typeof value === 'number' ? value : 0;
              if (name === 'xp') {
                return [`+${formatXp(numValue)}`, 'XP Gained'];
              }
              if (name === 'levels') {
                return [`+${numValue}`, 'Levels'];
              }
              return [String(numValue), String(name)];
            }}
          />
          <Bar
            dataKey="xp"
            fill="#d4af37"
            radius={[3, 3, 0, 0]}
            maxBarSize={32}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
