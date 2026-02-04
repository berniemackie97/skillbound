'use client';

import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface SkillGain {
  name: string;
  deltaXp: number;
  deltaLevel: number;
}

interface SkillGainsChartProps {
  gains: SkillGain[];
  maxItems?: number;
}

const SKILL_COLORS: Record<string, string> = {
  // Combat
  Attack: '#9d2933',
  Strength: '#00b300',
  Defence: '#5c6b8a',
  Ranged: '#5a7a23',
  Prayer: '#9d8f60',
  Magic: '#3a5bab',
  Hitpoints: '#8c2020',
  // Gathering
  Mining: '#5c4033',
  Fishing: '#4a92c7',
  Woodcutting: '#6b4423',
  Farming: '#2d5c36',
  Hunter: '#5c4033',
  // Artisan
  Smithing: '#4a4a4a',
  Cooking: '#8b4513',
  Firemaking: '#b33300',
  Crafting: '#7b5427',
  Fletching: '#008080',
  Herblore: '#006400',
  Runecrafting: '#8b7500',
  Construction: '#cd853f',
  // Support
  Agility: '#3d5a80',
  Thieving: '#5a3d5c',
  Slayer: '#3d3d3d',
  // Default
  default: '#d4af37',
};

function getSkillColor(skillName: string): string {
  const color = SKILL_COLORS[skillName];
  return color ?? '#d4af37';
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

export function SkillGainsChart({ gains, maxItems = 8 }: SkillGainsChartProps) {
  if (gains.length === 0) {
    return (
      <div className="chart-empty">
        <p>No skill gains detected yet.</p>
      </div>
    );
  }

  const chartData = gains.slice(0, maxItems);

  return (
    <div className="chart-container">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={150}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 5, right: 10, left: 5, bottom: 5 }}
        >
          <XAxis
            type="number"
            stroke="var(--text-muted)"
            tick={{ fontSize: 10 }}
            tickFormatter={formatXp}
            tickLine={{ stroke: 'rgba(226, 176, 101, 0.2)' }}
            axisLine={{ stroke: 'rgba(226, 176, 101, 0.2)' }}
          />
          <YAxis
            type="category"
            dataKey="name"
            stroke="var(--text-muted)"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={80}
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
              const strName = String(name);
              if (strName === 'deltaXp') {
                return [`+${formatXp(numValue)} XP`, 'Experience'];
              }
              return [String(numValue), strName];
            }}
          />
          <Bar
            dataKey="deltaXp"
            radius={[0, 4, 4, 0]}
            maxBarSize={24}
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={getSkillColor(entry.name)}
                opacity={0.85}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
