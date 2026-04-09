'use client';

import { DeathsCofferCard } from './deaths-coffer-card';
import { MultiAccountCard } from './multi-account-card';
import { PortfolioCard } from './portfolio-card';
import { RiskMetricsCard } from './risk-metrics-card';
import { SetArbitrageCard } from './set-arbitrage-card';

export function MarketToolsDashboard() {
  return (
    <div className="market-tools">
      <div className="market-tools-header">
        <h2>Market Tools</h2>
        <span className="tools-badge">Live</span>
      </div>

      <div className="market-tools-grid">
        <RiskMetricsCard />
        <PortfolioCard />
        <SetArbitrageCard />
        <DeathsCofferCard />
        <MultiAccountCard />
      </div>
    </div>
  );
}
