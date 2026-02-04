'use client';

import { PriceChart, type PriceChartProps } from './price-chart';

type PriceChartPanelProps = PriceChartProps & {
  variant?: 'detail' | 'table';
};

export function PriceChartPanel({ variant = 'detail', ...props }: PriceChartPanelProps) {
  return (
    <section className={`price-chart-panel ${variant}`}>
      <PriceChart {...props} />
    </section>
  );
}
