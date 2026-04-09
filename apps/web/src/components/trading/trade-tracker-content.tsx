import type { CharacterSummary } from '@/lib/character/character-selection';
import {
  getBankroll,
  getCharacterTrades,
  getInventorySummary,
  getProfitSummary,
  getTradingOverview,
  getUserProfitSummary,
  getUserTrades,
  getUserTradingOverview,
  getWatchList,
  type TimePeriod,
} from '@/lib/trading/trading-service';

import { BankrollCard } from './bankroll-card';
import { DeathsCofferCard } from './deaths-coffer-card';
import { InventoryCard } from './inventory-card';
import { LiveAlerts } from './live-alerts';
import { MultiAccountCard } from './multi-account-card';
import { PortfolioCard } from './portfolio-card';
import { RiskMetricsCard } from './risk-metrics-card';
import { SetArbitrageCard } from './set-arbitrage-card';
import { TradeFilters } from './trade-filters';
import { TradeForm } from './trade-form';
import { TradeList } from './trade-list';
import { TradingMobileActions } from './trading-mobile-actions';
import { TradingOverview } from './trading-overview';
import { WatchList } from './watch-list';

type TradeTrackerContentProps = {
  userId: string;
  characterId: string;
  characterName: string;
  period: TimePeriod;
  page: number;
  preselectedItemId?: number;
  scope: 'character' | 'all';
  tradeType: 'buy' | 'sell' | 'all';
  search: string;
  characters: CharacterSummary[];
};

function periodLabel(period: TimePeriod): string {
  switch (period) {
    case 'today':
      return 'Today';
    case 'week':
      return 'This Week';
    case 'month':
      return 'This Month';
    case 'year':
      return 'This Year';
    case 'all':
    default:
      return 'All Time';
  }
}

export async function TradeTrackerContent({
  userId,
  characterId,
  characterName,
  period,
  page,
  preselectedItemId,
  scope,
  tradeType,
  search,
  characters,
}: TradeTrackerContentProps) {
  const pageSize = 20;
  const offset = (page - 1) * pageSize;

  const tradeTypeFilter = tradeType === 'all' ? undefined : tradeType;
  const searchFilter = search.trim() || undefined;

  const [
    overview,
    profitSummary,
    tradesResult,
    watchItems,
    bankroll,
    inventory,
  ] =
    scope === 'all'
      ? await Promise.all([
          getUserTradingOverview(userId),
          getUserProfitSummary(userId, period),
          getUserTrades(userId, {
            period,
            tradeType: tradeTypeFilter,
            search: searchFilter,
            limit: pageSize,
            offset,
          }),
          // For now, we still need a concrete characterId to attach watch-list.
          // When we add multi-character watch aggregation, this can become user-scoped.
          getWatchList(characterId, true),
          getBankroll(characterId),
          getInventorySummary(characterId),
        ])
      : await Promise.all([
          getTradingOverview(characterId),
          getProfitSummary(characterId, period),
          getCharacterTrades(characterId, {
            period,
            tradeType: tradeTypeFilter,
            search: searchFilter,
            limit: pageSize,
            offset,
          }),
          getWatchList(characterId, true),
          getBankroll(characterId),
          getInventorySummary(characterId),
        ]);

  const hasBankroll = Boolean(
    bankroll && (bankroll.currentBankroll > 0 || bankroll.initialBankroll > 0)
  );

  return (
    <div className="tracker-layout">
      <section className="tracker-stats">
        <TradingOverview
          overview={overview}
          periodLabel={periodLabel(period)}
          summary={profitSummary}
        />
      </section>

      <div className="tracker-grid">
        <div className="tracker-primary">
          <div className="tracker-primary-mobile">
            <TradingMobileActions
              availableBankroll={bankroll?.currentBankroll ?? 0}
              bankroll={bankroll ?? { currentBankroll: 0, initialBankroll: 0 }}
              characterId={characterId}
              hasBankroll={hasBankroll}
              scope={scope}
              totalProfit={profitSummary.totalProfit}
              {...(preselectedItemId !== undefined && { preselectedItemId })}
            />
          </div>

          <div className="tracker-primary-desktop">
            <BankrollCard
              bankroll={bankroll ?? { currentBankroll: 0, initialBankroll: 0 }}
              characterId={characterId}
              totalProfit={profitSummary.totalProfit}
            />
          </div>

          <div className="tracker-card tracker-primary-desktop">
            <div className="tracker-card-header">
              <h3>Record Trade</h3>
              {scope === 'all' && (
                <span className="card-badge">Using active character</span>
              )}
            </div>
            <TradeForm
              availableBankroll={bankroll?.currentBankroll ?? 0}
              characterId={characterId}
              hasBankroll={hasBankroll}
              {...(preselectedItemId !== undefined && { preselectedItemId })}
            />
          </div>
        </div>

        <div className="tracker-main">
          <div className="tracker-card trades-card" id="trade-history">
            <div className="tracker-card-header">
              <h3>Trade History</h3>
              <span className="card-subtitle">
                {scope === 'all' ? 'All Characters' : characterName}
              </span>
            </div>

            <TradeFilters
              activeCharacterId={characterId}
              activeCharacterName={characterName}
              characters={characters}
              period={period}
              scope={scope}
              search={search}
              selectedCharacterId={scope === 'all' ? null : characterId}
              tradeType={tradeType}
            />

            <TradeList
              characterId={characterId}
              currentPage={page}
              pageSize={pageSize}
              total={tradesResult.total}
              trades={tradesResult.trades.map((t) => ({
                ...t,
                characterId: t.userCharacterId,
                tradedAt: t.tradedAt.toISOString(),
              }))}
            />
          </div>
        </div>

        <div className="tracker-sidebar">
          <div id="live-alerts">
            <LiveAlerts inventory={inventory} watchItems={watchItems} />
          </div>
          <InventoryCard inventory={inventory} />

          <div className="tracker-card watchlist-card" id="watch-list">
            <WatchList characterId={characterId} items={watchItems} />
          </div>
        </div>
      </div>

      <section className="tracker-insights">
        <div className="tracker-insights-header">
          <h3>Analytics</h3>
          <span className="tools-badge">Live</span>
        </div>
        <div className="tracker-insights-grid">
          <RiskMetricsCard />
          <PortfolioCard />
        </div>
      </section>

      <section className="tracker-opportunities">
        <div className="tracker-insights-header">
          <h3>Market Opportunities</h3>
          <span className="tools-badge">Live</span>
        </div>
        <div className="tracker-insights-grid">
          <SetArbitrageCard />
          <DeathsCofferCard />
          <MultiAccountCard />
        </div>
      </section>
    </div>
  );
}
