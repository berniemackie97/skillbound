import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ItemDetailClient, PriceChartPanel } from '@/components/ge';
import {
  formatGp,
  formatRoi,
  formatTimeAgo,
  getGeItem,
  getItemIconUrl,
} from '@/lib/trading/ge-service';

type PageParams = { id: string };

function parseItemId(raw: string): number | null {
  // Only allow base-10 integers. Reject empty strings, NaN, and non-positive ids.
  if (!raw || !/^\d+$/.test(raw)) return null;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function buildWikiUrl(itemName: string): string {
  // OSRS Wiki uses underscores for spaces, and URL encoding for special chars.
  const slug = itemName.replace(/\s+/g, '_');
  return `https://oldschool.runescape.wiki/w/${encodeURIComponent(slug)}`;
}

function formatLocalTimestamp(date: Date): string {
  // Keep formatting deterministic and short.
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function profitClass(profit: number | null): string {
  if (profit === null) return 'negative';
  return profit >= 0 ? 'positive' : 'negative';
}

export async function generateMetadata({
  params,
}: {
  params: PageParams;
}): Promise<Metadata> {
  const itemId = parseItemId(params.id);
  if (!itemId) return { title: 'Item Not Found - Skillbound' };

  const item = await getGeItem(itemId);
  if (!item) return { title: 'Item Not Found - Skillbound' };

  const buy = item.buyPrice !== null ? formatGp(item.buyPrice) : 'Unknown';
  const sell = item.sellPrice !== null ? formatGp(item.sellPrice) : 'Unknown';

  return {
    title: `${item.name} - GE Prices - Skillbound`,
    description: `Live Grand Exchange pricing for ${item.name}. Current buy price: ${buy}, sell price: ${sell}. Track margins, volume, and price history.`,
  };
}

export default async function ItemDetailPage({
  params,
}: {
  params: Promise<PageParams>;
}) {
  const { id } = await params;
  const itemId = parseItemId(id);
  if (!itemId) notFound();

  const item = await getGeItem(itemId);
  if (!item) notFound();

  // Prefer whichever timestamp we have.
  const lastTradeTime: Date | null = item.buyPriceTime ?? item.sellPriceTime ?? null;
  const lastTradeDate = lastTradeTime ? formatLocalTimestamp(lastTradeTime) : null;

  const wikiUrl = buildWikiUrl(item.name);

  return (
    <main className="page item-detail-page">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/trading">GE Exchange</Link>
        <span className="separator" aria-hidden="true">
          ›
        </span>
        <span aria-current="page">{item.name}</span>
      </nav>

      <header className="item-header">
        <div className="item-title">
          {/* Keep <img> to avoid Next/Image remote-domain config footguns. */}
          <img
            src={getItemIconUrl(item.icon)}
            alt={`${item.name} icon`}
            className="item-icon-large"
            width={48}
            height={48}
            loading="eager"
          />

          <div>
            <h1>{item.name}</h1>
            <p className="item-subtitle">Live Grand Exchange pricing information</p>
            {lastTradeTime && lastTradeDate && (
              <p className="last-trade-info">
                Last Trade: {formatTimeAgo(lastTradeTime)} • {lastTradeDate}
              </p>
            )}
          </div>
        </div>

        <div className="item-quick-stats">
          {item.profit !== null && (
            <span className={`profit-badge ${profitClass(item.profit)}`}>
              Profit: {item.profit >= 0 ? '+' : ''}
              {formatGp(item.profit)} gp/ea • {formatRoi(item.roiPercent)} ROI
            </span>
          )}

          <ItemDetailClient itemId={item.id} initialFavorite={false} />
        </div>
      </header>

      <section className="price-cards">
        <div className="price-card buy">
          <span className="price-label">BUY PRICE</span>
          <div className="price-value">
            <span className="price-indicator" aria-hidden="true">
              ▼
            </span>
            <span className="price-amount">
              {item.buyPrice !== null ? item.buyPrice.toLocaleString() : 'Unknown'}
            </span>
            <span className="price-unit">gp</span>
          </div>
          <span className="price-time">
            {item.buyPriceTime ? formatTimeAgo(item.buyPriceTime) : 'Unknown'}
          </span>
        </div>

        <div className="price-card sell">
          <span className="price-label">SELL PRICE</span>
          <div className="price-value">
            <span className="price-indicator" aria-hidden="true">
              ▲
            </span>
            <span className="price-amount">
              {item.sellPrice !== null ? item.sellPrice.toLocaleString() : 'Unknown'}
            </span>
            <span className="price-unit">gp</span>
          </div>
          <span className="price-time">
            {item.sellPriceTime ? formatTimeAgo(item.sellPriceTime) : 'Unknown'}
          </span>
        </div>
      </section>

      <section className="stats-row">
        <div className="stat-item">
          <span className="stat-label">PROFIT</span>
          <span className={`stat-value ${profitClass(item.profit)}`}>
            {formatGp(item.profit)}
          </span>
          <span className="stat-unit">gp/ea</span>
        </div>

        <div className="stat-item">
          <span className="stat-label">POTENTIAL PROFIT</span>
          <span className="stat-value positive">{formatGp(item.potentialProfit)}</span>
        </div>

        <div className="stat-item">
          <span className="stat-label">VOLUME</span>
          <span className="stat-value">{item.volume?.toLocaleString() ?? '-'}</span>
          <span className="stat-unit">/day</span>
        </div>

        <div className="stat-item">
          <span className="stat-label">BUY LIMIT</span>
          <span className="stat-value">{item.buyLimit?.toLocaleString() ?? '-'}</span>
          <span className="stat-unit">/4hrs</span>
        </div>
      </section>

      <details className="more-details">
        <summary>MORE DETAILS</summary>
        <div className="details-grid">
          <div className="detail-item">
            <span className="detail-label">Margin</span>
            <span className="detail-value">{formatGp(item.margin)}</span>
          </div>

          <div className="detail-item">
            <span className="detail-label">Tax</span>
            <span className="detail-value">
              {item.tax !== null ? `-${formatGp(item.tax)}` : '-'}
            </span>
          </div>

          <div className="detail-item">
            <span className="detail-label">ROI</span>
            <span className={`detail-value ${profitClass(item.roiPercent)}`}>
              {formatRoi(item.roiPercent)}
            </span>
          </div>

          <div className="detail-item">
            <span className="detail-label">High Alch</span>
            <span className="detail-value">{item.highAlch ? formatGp(item.highAlch) : '-'}</span>
          </div>

          <div className="detail-item">
            <span className="detail-label">Low Alch</span>
            <span className="detail-value">{item.lowAlch ? formatGp(item.lowAlch) : '-'}</span>
          </div>

          <div className="detail-item">
            <span className="detail-label">Members</span>
            <span className="detail-value">{item.members ? 'Yes' : 'No'}</span>
          </div>

          <div className="detail-item full-width">
            <span className="detail-label">Examine</span>
            <span className="detail-value">{item.examine}</span>
          </div>
        </div>
      </details>

      <PriceChartPanel
        itemId={item.id}
        itemName={item.name}
        itemIcon={item.icon}
        variant="detail"
      />

      <section className="actions-section">
        <a
          href={wikiUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="action-link wiki"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" aria-hidden="true">
            <path d="M14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z" />
            <path d="M5 5v14h14v-7h-2v5H7V7h5V5H5z" />
          </svg>
          Wiki
        </a>
      </section>
    </main>
  );
}
