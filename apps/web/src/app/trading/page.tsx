import { Suspense } from 'react';

import { ExchangeClient } from '@/components/ge';
import {
  BankrollCard,
  LiveAlerts,
  InventoryCard,
  TradeForm,
  TradeFilters,
  TradeList,
  TradingMobileActions,
  TradingOverview,
  WatchList,
} from '@/components/trading';
import { getSessionUser } from '@/lib/auth/auth-helpers';
import {
  getTradableCharacters,
  getUserCharacters,
} from '@/lib/character/character-selection';
import { buildPageMetadata } from '@/lib/seo/metadata';
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

export const metadata = buildPageMetadata({
  title: 'OSRS GE Tracker & Flipping',
  description:
    'Live Grand Exchange prices, flipping tools, margin tracking, and trade profit insights for OSRS.',
  canonicalPath: '/trading',
});

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
const PERIODS: Record<TimePeriod, true> = {
  today: true,
  week: true,
  month: true,
  year: true,
  all: true,
};

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

function parseOrderList(
  value: string | undefined,
  length: number
): SortDirection[] {
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
  return v in PERIODS ? (v as TimePeriod) : 'all';
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
  isSignedIn,
}: {
  sort: string;
  order: string;
  page: number;
  search: string;
  isSignedIn: boolean;
}) {
  let items = await getGeExchangeItems();

  if (search) {
    const searchLower = search.toLowerCase();
    items = items.filter((item) =>
      item.name.toLowerCase().includes(searchLower)
    );
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
      isSignedIn={isSignedIn}
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

  let character:
    | Awaited<ReturnType<typeof getTradableCharacters>>[number]
    | null = null;
  let characters: Awaited<ReturnType<typeof getTradableCharacters>> = [];
  let hasOnlyIronmanCharacters = false;

  if (user) {
    const allCharacters = await getUserCharacters(user.id);
    characters = await getTradableCharacters(user.id);
    hasOnlyIronmanCharacters =
      allCharacters.length > 0 && characters.length === 0;
    character =
      (selectedCharacterId
        ? characters.find((entry) => entry.id === selectedCharacterId)
        : null) ??
      characters[0] ??
      null;
  }

  return (
    <div className="trading-page ge-exchange-page">
      <section className="page-header trading-header">
        <div className="header-content">
          <h1>GE Exchange</h1>
          <p className="subtitle">
            Live Grand Exchange prices powered by RuneLite crowdsourced data
          </p>
        </div>

        <nav aria-label="Trading sections" className="trading-tabs">
          <a
            aria-current={activeTab === 'exchange' ? 'page' : undefined}
            className={`tab-btn ${activeTab === 'exchange' ? 'active' : ''}`}
            href="/trading?tab=exchange"
          >
            <svg
              fill="none"
              height="18"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
              width="18"
            >
              <path d="M3 3h18v18H3z" />
              <path d="M3 9h18M9 21V9" />
            </svg>
            GE Exchange
          </a>

          <a
            aria-current={activeTab === 'tracker' ? 'page' : undefined}
            className={`tab-btn ${activeTab === 'tracker' ? 'active' : ''}`}
            href="/trading?tab=tracker"
          >
            <svg
              fill="none"
              height="18"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
              width="18"
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
              isSignedIn={Boolean(user)}
              order={order}
              page={exchangePage}
              search={exchangeSearch}
              sort={sort}
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
              <a className="button" href="/login?redirect=/trading?tab=tracker">
                Login to Track Trades
              </a>
            </div>
          ) : !character ? (
            <div className="character-prompt">
              {hasOnlyIronmanCharacters ? (
                <>
                  <h2>Trading Needs a Standard Character</h2>
                  <p>
                    Your saved characters are all Ironman accounts, which cannot
                    trade on the Grand Exchange. Add or switch to a standard
                    character to track trades here.
                  </p>
                  <a
                    className="button"
                    href="/characters?redirect=/trading?tab=tracker"
                  >
                    Manage Characters
                  </a>
                </>
              ) : (
                <>
                  <h2>Select a Character</h2>
                  <p>
                    You need to select an active character to track trades. Each
                    character has its own trade history.
                  </p>
                  <a
                    className="button"
                    href="/characters?redirect=/trading?tab=tracker"
                  >
                    Select Character
                  </a>
                </>
              )}
            </div>
          ) : (
            <TradeTrackerContent
              characterId={character.id}
              characterName={character.displayName}
              characters={characters}
              page={trackerPage}
              period={period}
              scope={scope}
              search={trackerSearch}
              tradeType={tradeType}
              userId={user.id}
              {...(preselectedItemId !== undefined && { preselectedItemId })}
            />
          )}
        </section>
      )}
    </div>
  );
}
