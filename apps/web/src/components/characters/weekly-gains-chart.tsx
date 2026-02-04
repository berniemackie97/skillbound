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
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={200}>
        <BarChart
          data={chartData}
          margin={{ top: 10, right: 10, left: 0, bottom: 30 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(226, 176, 101, 0.1)"
            vertical={false}
          />
          <XAxis
            dataKey="name"
            stroke="var(--text-muted)"
            tick={{ fontSize: 10 }}
            tickLine={{ stroke: 'rgba(226, 176, 101, 0.2)' }}
            axisLine={{ stroke: 'rgba(226, 176, 101, 0.2)' }}
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis
            stroke="var(--text-muted)"
            tick={{ fontSize: 10 }}
            tickFormatter={formatXp}
            tickLine={{ stroke: 'rgba(226, 176, 101, 0.2)' }}
            axisLine={{ stroke: 'rgba(226, 176, 101, 0.2)' }}
            width={50}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(30, 25, 18, 0.95)',
              border: '1px solid rgba(226, 176, 101, 0.3)',
              borderRadius: '8px',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
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
            radius={[4, 4, 0, 0]}
            maxBarSize={40}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
