import type { Metadata } from 'next';
import { Suspense } from 'react';

import { ExchangeClient } from '@/components/ge';
import {
  BankrollCard,
  InventoryCard,
  ProfitSummary,
  TradeForm,
  TradeFilters,
  TradeList,
  TradingOverview,
  WatchList,
} from '@/components/trading';
import { getSessionUser } from '@/lib/auth/auth-helpers';
import { getTradableCharacters } from '@/lib/character/character-selection';
import {
  getGeExchangeItems,
  sortItemsMulti,
  type SortDirection,
  type SortField,
} from '@/lib/trading/ge-service';
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

export const metadata: Metadata = {
  title: 'GE Exchange & Trading - Skillbound',
  description:
    'Live Grand Exchange prices, flip tracking, and profit tracking for OSRS. Track margins, ROI, and your personal trades.',
};

const DEFAULT_SORT_FIELDS: SortField[] = [
  'name',
  'buyPrice',
  'sellPrice',
  'margin',
  'tax',
  'profit',
  'roiPercent',
  'volume',
  'buyLimit',
  'potentialProfit',
  'lastTrade',
];

type TradingTab = 'exchange' | 'tracker';

type TradingSearchParams = {
  tab?: string;
  period?: string;
  page?: string;
  sort?: string;
  order?: string;
  search?: string;
  addTrade?: string;
  scope?: string;
  tradeType?: string;
  characterId?: string;
};

type PageProps = {
  // Next.js may provide searchParams as either an object or a Promise depending on
  // route configuration and framework version. Handle both.
  searchParams?: TradingSearchParams | Promise<TradingSearchParams>;
};

async function resolveSearchParams(
  searchParams: PageProps['searchParams']
): Promise<TradingSearchParams> {
  if (!searchParams) return {};
  // If it's already an object, Promise.resolve returns it unchanged.
  return Promise.resolve(searchParams);
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
}

function parseTab(value: string | undefined): TradingTab {
  return value === 'tracker' ? 'tracker' : 'exchange';
}

function parseSortList(
  value: string | undefined,
  validFields: SortField[] = DEFAULT_SORT_FIELDS
): SortField[] {
  const candidates = (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  const valid = candidates.filter((entry) =>
    validFields.includes(entry as SortField)
  );

  return valid.length > 0 ? (valid as SortField[]) : ['profit'];
}

function parseOrderList(value: string | undefined, length: number): SortDirection[] {
  const candidates = (value ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  return Array.from({ length }, (_, index) =>
    candidates[index] === 'asc' ? 'asc' : 'desc'
  );
}

function parsePeriod(value: string | undefined): TimePeriod {
  const v = value ?? '';
  return (['today', 'week', 'month', 'year', 'all'] as const).includes(v as any)
    ? (v as TimePeriod)
    : 'all';
}

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

function parseScope(value: string | undefined): 'character' | 'all' {
  return value === 'character' ? 'character' : 'all';
}

function parseTradeType(value: string | undefined): 'buy' | 'sell' | 'all' {
  return value === 'buy' || value === 'sell' ? value : 'all';
}

function parseOptionalInt(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function ExchangeLoading() {
  return (
    <div className="exchange-loading">
      <div className="loading-spinner" />
      <p>Loading GE prices...</p>
    </div>
  );
}

async function GEExchangeContent({
  sort,
  order,
  page,
  search,
}: {
  sort: string;
  order: string;
  page: number;
  search: string;
}) {
  let items = await getGeExchangeItems();

  if (search) {
    const searchLower = search.toLowerCase();
    items = items.filter((item) => item.name.toLowerCase().includes(searchLower));
  }

  const sortFields = parseSortList(sort);
  const sortOrders = parseOrderList(order, sortFields.length);

  const sorts = sortFields.map((field, index) => ({
    field,
    direction: sortOrders[index] ?? 'desc',
  }));

  items = sortItemsMulti(items, sorts);

  const limit = 25;
  const total = items.length;
  const totalPages = Math.ceil(total / limit);
  const offset = (page - 1) * limit;
  const paginatedItems = items.slice(offset, offset + limit);

  const serializedItems = paginatedItems.map((item) => ({
    ...item,
    buyPriceTime: item.buyPriceTime?.toISOString() ?? null,
    sellPriceTime: item.sellPriceTime?.toISOString() ?? null,
  }));

  return (
    <ExchangeClient
      initialItems={serializedItems}
      initialMeta={{
        total,
        page,
        limit,
        totalPages,
        sort: sortFields.join(','),
        order: sortOrders.join(','),
      }}
    />
  );
}

async function TradeTrackerContent({
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
}: {
  userId: string;
  characterId: string;
  characterName: string;
  period: TimePeriod;
  page: number;
  preselectedItemId?: number;
  scope: 'character' | 'all';
  tradeType: 'buy' | 'sell' | 'all';
  search: string;
  characters: Awaited<ReturnType<typeof getTradableCharacters>>;
}) {
  const pageSize = 20;
  const offset = (page - 1) * pageSize;

  const tradeTypeFilter = tradeType === 'all' ? undefined : tradeType;
  const searchFilter = search.trim() || undefined;

  const [overview, profitSummary, tradesResult, watchItems, bankroll, inventory] =
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

  return (
    <div className="tracker-layout">
      <section className="tracker-stats">
        <TradingOverview overview={overview} />
      </section>

      <div className="tracker-grid">
        <div className="tracker-primary">
          <BankrollCard
            characterId={characterId}
            bankroll={bankroll ?? { currentBankroll: 0, initialBankroll: 0 }}
            totalProfit={profitSummary.totalProfit}
          />

          <div className="tracker-card">
            <div className="tracker-card-header">
              <h3>Record Trade</h3>
              {scope === 'all' && (
                <span className="card-badge">Using active character</span>
              )}
            </div>
            <TradeForm
              characterId={characterId}
              {...(preselectedItemId !== undefined && { preselectedItemId })}
            />
          </div>

          <div className="tracker-card">
            <div className="tracker-card-header">
              <h3>Profit Analysis</h3>
              <span className="card-subtitle">{periodLabel(period)}</span>
            </div>
            <ProfitSummary summary={profitSummary} />
          </div>
        </div>

        <div className="tracker-main">
          <div className="tracker-card trades-card">
            <div className="tracker-card-header">
              <h3>Trade History</h3>
              <span className="card-subtitle">
                {scope === 'all' ? 'All Characters' : characterName}
              </span>
            </div>

            <TradeFilters
              characters={characters}
              activeCharacterId={characterId}
              activeCharacterName={characterName}
              scope={scope}
              selectedCharacterId={scope === 'all' ? null : characterId}
              tradeType={tradeType}
              search={search}
              period={period}
            />

            <TradeList
              characterId={characterId}
              trades={tradesResult.trades.map((t) => ({
                ...t,
                characterId: t.userCharacterId,
                tradedAt: t.tradedAt.toISOString(),
              }))}
              total={tradesResult.total}
              currentPage={page}
              pageSize={pageSize}
            />
          </div>
        </div>

        <div className="tracker-sidebar">
          <InventoryCard inventory={inventory} />

          <div className="tracker-card watchlist-card">
            <WatchList characterId={characterId} items={watchItems} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function TradingPage({ searchParams }: PageProps) {
  const user = await getSessionUser();
  const params = await resolveSearchParams(searchParams);

  const activeTab = parseTab(params.tab);

  // IMPORTANT: We intentionally avoid cross-talk between tabs.
  // The app currently uses shared query keys (`page`, `search`) across tabs.
  // If the user is on tracker tab, we treat `page/search` as tracker params and
  // reset the exchange params to defaults (and vice-versa).
  const exchangeSearch = activeTab === 'exchange' ? (params.search ?? '') : '';
  const exchangePage =
    activeTab === 'exchange' ? parsePositiveInt(params.page, 1) : 1;

  const trackerSearch = activeTab === 'tracker' ? (params.search ?? '') : '';
  const trackerPage =
    activeTab === 'tracker' ? parsePositiveInt(params.page, 1) : 1;

  // Exchange sorting params
  const sortFields = parseSortList(params.sort, DEFAULT_SORT_FIELDS);
  const sort = sortFields.join(',');
  const order = parseOrderList(params.order, sortFields.length).join(',');

  // Tracker params
  const period = parsePeriod(params.period);
  const scope = parseScope(params.scope);
  const tradeType = parseTradeType(params.tradeType);
  const selectedCharacterId = params.characterId ?? null;
  const preselectedItemId = parseOptionalInt(params.addTrade);

  let character: Awaited<ReturnType<typeof getTradableCharacters>>[number] | null =
    null;
  let characters: Awaited<ReturnType<typeof getTradableCharacters>> = [];

  if (user) {
    characters = await getTradableCharacters(user.id);
    character =
      (selectedCharacterId
        ? characters.find((entry) => entry.id === selectedCharacterId)
        : null) ??
      characters[0] ??
      null;
  }

  return (
    <main className="page trading-page ge-exchange-page">
      <section className="page-header trading-header">
        <div className="header-content">
          <h1>GE Exchange</h1>
          <p className="subtitle">
            Live Grand Exchange prices powered by RuneLite crowdsourced data
          </p>
        </div>

        <nav className="trading-tabs" role="tablist">
          <a
            href="/trading?tab=exchange"
            className={`tab-btn ${activeTab === 'exchange' ? 'active' : ''}`}
            role="tab"
            aria-selected={activeTab === 'exchange'}
          >
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M3 3h18v18H3z" />
              <path d="M3 9h18M9 21V9" />
            </svg>
            GE Exchange
          </a>

          <a
            href="/trading?tab=tracker"
            className={`tab-btn ${activeTab === 'tracker' ? 'active' : ''}`}
            role="tab"
            aria-selected={activeTab === 'tracker'}
          >
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
            My Trades
            {!user && <span className="login-badge">Login</span>}
          </a>
        </nav>
      </section>

      {activeTab === 'exchange' && (
        <section className="ge-exchange-section">
          <Suspense fallback={<ExchangeLoading />}>
            <GEExchangeContent
              sort={sort}
              order={order}
              page={exchangePage}
              search={exchangeSearch}
            />
          </Suspense>
        </section>
      )}

      {activeTab === 'tracker' && (
        <section className="trade-tracker-section">
          {!user ? (
            <div className="login-prompt">
              <h2>Login Required</h2>
              <p>
                You need to be logged in to track your trades. Your trades are
                saved per character and are completely private.
              </p>
              <a
                href="/login?redirect=/trading?tab=tracker"
                className="button"
              >
                Login to Track Trades
              </a>
            </div>
          ) : !character ? (
            <div className="character-prompt">
              <h2>Select a Character</h2>
              <p>
                You need to select an active character to track trades. Each
                character has its own trade history.
              </p>
              <a
                href="/characters?redirect=/trading?tab=tracker"
                className="button"
              >
                Select Character
              </a>
            </div>
          ) : (
            <TradeTrackerContent
              userId={user.id}
              characterId={character.id}
              characterName={character.displayName}
              period={period}
              page={trackerPage}
              scope={scope}
              tradeType={tradeType}
              search={trackerSearch}
              characters={characters}
              {...(preselectedItemId !== undefined && { preselectedItemId })}
            />
          )}
        </section>
      )}
    </main>
  );
}
