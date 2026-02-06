import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { ExchangeClientShell } from '@/components/ge';
import { TradingHeader } from '@/components/trading/trading-header';
import { buildPageMetadata } from '@/lib/seo/metadata';
import {
  getGeExchangeItems,
  sortItemsMulti,
  type SortDirection,
  type SortField,
} from '@/lib/trading/ge-service';

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

type TradingSearchParams = {
  tab?: string;
  page?: string;
  sort?: string;
  order?: string;
  search?: string;
  addTrade?: string;
  period?: string;
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
  return Promise.resolve(searchParams);
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
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
    <ExchangeClientShell
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

export default async function TradingPage({ searchParams }: PageProps) {
  const params = await resolveSearchParams(searchParams);

  const shouldRedirectToTracker =
    params.tab === 'tracker' ||
    Boolean(params.addTrade) ||
    Boolean(params.period) ||
    Boolean(params.scope) ||
    Boolean(params.tradeType) ||
    Boolean(params.characterId);

  if (shouldRedirectToTracker) {
    const redirectParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (key === 'tab') return;
      if (!value) return;
      redirectParams.set(key, value);
    });
    const query = redirectParams.toString();
    redirect(query ? `/trading/tracker?${query}` : '/trading/tracker');
  }

  const exchangeSearch = params.search ?? '';
  const exchangePage = parsePositiveInt(params.page, 1);

  const sortFields = parseSortList(params.sort, DEFAULT_SORT_FIELDS);
  const sort = sortFields.join(',');
  const order = parseOrderList(params.order, sortFields.length).join(',');

  return (
    <div className="trading-page ge-exchange-page">
      <TradingHeader activeTab="exchange" />

      <section className="ge-exchange-section">
        <Suspense fallback={<ExchangeLoading />}>
          <GEExchangeContent
            order={order}
            page={exchangePage}
            search={exchangeSearch}
            sort={sort}
          />
        </Suspense>
      </section>
    </div>
  );
}
