'use client';

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

interface ActivityData {
  name: string;
  value: number;
  fullMark?: number;
}

interface ActivityRadarChartProps {
  activities: ActivityData[];
}

export function ActivityRadarChart({ activities }: ActivityRadarChartProps) {
  if (activities.length === 0) {
    return (
      <div className="chart-empty">
        <p>No activity data available yet.</p>
      </div>
    );
  }

  // Calculate fullMark as max value for normalization
  const maxValue = Math.max(...activities.map((a) => a.value));
  const dataWithMarks = activities.map((activity) => ({
    ...activity,
    fullMark: maxValue,
  }));

  return (
    <div className="chart-container">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={150}>
        <RadarChart
          cx="50%"
          cy="50%"
          outerRadius="70%"
          data={dataWithMarks}
        >
          <PolarGrid
            stroke="rgba(226, 176, 101, 0.15)"
            strokeDasharray="3 3"
          />
          <PolarAngleAxis
            dataKey="name"
            tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
            tickLine={false}
          />
          <PolarRadiusAxis
            angle={30}
            domain={[0, maxValue]}
            tick={{ fill: 'var(--text-muted)', fontSize: 9 }}
            tickFormatter={(value) => {
              if (value >= 1000) {
                return `${(value / 1000).toFixed(0)}k`;
              }
              return String(value);
            }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(30, 25, 18, 0.95)',
              border: '1px solid rgba(226, 176, 101, 0.3)',
              borderRadius: '8px',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
            }}
            formatter={(value) => [
              typeof value === 'number' ? value.toLocaleString() : value,
              'Count',
            ]}
          />
          <Radar
            name="Activity"
            dataKey="value"
            stroke="#d4af37"
            fill="#d4af37"
            fillOpacity={0.3}
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
