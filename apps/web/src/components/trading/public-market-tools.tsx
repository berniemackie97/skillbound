'use client';

import { DeathsCofferCard } from './deaths-coffer-card';
import { SetArbitrageCard } from './set-arbitrage-card';

export function PublicMarketTools() {
  return (
    <div className="market-tools">
      <div className="market-tools-header">
        <h2>Market Tools</h2>
        <span className="tools-badge">Live</span>
      </div>

      <div className="market-tools-grid two-col">
        <SetArbitrageCard />
        <DeathsCofferCard />
      </div>
    </div>
  );
}
