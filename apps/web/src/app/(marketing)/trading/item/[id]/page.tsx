import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ItemDetailClient, PriceChartPanel } from '@/components/ge';
import { buildPageMetadata } from '@/lib/seo/metadata';
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
  params: Promise<PageParams>;
}): Promise<Metadata> {
  const { id } = await params;
  const itemId = parseItemId(id);
  if (!itemId) {
    return {
      title: 'Item Not Found - SkillBound',
      robots: { index: false, follow: true },
    };
  }

  const item = await getGeItem(itemId);
  if (!item) {
    return {
      title: 'Item Not Found - SkillBound',
      robots: { index: false, follow: true },
    };
  }

  const buy = item.buyPrice !== null ? formatGp(item.buyPrice) : 'Unknown';
  const sell = item.sellPrice !== null ? formatGp(item.sellPrice) : 'Unknown';

  return buildPageMetadata({
    title: `${item.name} - OSRS GE Price`,
    description: `Live Grand Exchange pricing for ${item.name}. Current buy price: ${buy}, sell price: ${sell}. Track margins, volume, and price history.`,
    canonicalPath: `/trading/item/${item.id}`,
  });
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
  const lastTradeTime: Date | null =
    item.buyPriceTime ?? item.sellPriceTime ?? null;
  const lastTradeDate = lastTradeTime
    ? formatLocalTimestamp(lastTradeTime)
    : null;

  const wikiUrl = buildWikiUrl(item.name);

  return (
    <section className="item-detail-page">
      <nav aria-label="Breadcrumb" className="breadcrumb">
        <Link href="/trading">GE Exchange</Link>
        <span aria-hidden="true" className="separator">
          ›
        </span>
        <span aria-current="page">{item.name}</span>
      </nav>

      <header className="item-header">
        <div className="item-title">
          <Image
            priority
            alt={`${item.name} icon`}
            className="item-icon-large"
            height={48}
            src={getItemIconUrl(item.icon)}
            width={48}
          />

          <div>
            <h1>{item.name}</h1>
            <p className="item-subtitle">
              Live Grand Exchange pricing information
            </p>
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

          <ItemDetailClient initialFavorite={false} itemId={item.id} />
        </div>
      </header>

      <section className="price-cards">
        <div className="price-card buy">
          <span className="price-label">BUY PRICE</span>
          <div className="price-value">
            <span aria-hidden="true" className="price-indicator">
              ▼
            </span>
            <span className="price-amount">
              {item.buyPrice !== null
                ? item.buyPrice.toLocaleString()
                : 'Unknown'}
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
            <span aria-hidden="true" className="price-indicator">
              ▲
            </span>
            <span className="price-amount">
              {item.sellPrice !== null
                ? item.sellPrice.toLocaleString()
                : 'Unknown'}
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
          <span className="stat-value positive">
            {formatGp(item.potentialProfit)}
          </span>
        </div>

        <div className="stat-item">
          <span className="stat-label">VOLUME</span>
          <span className="stat-value">
            {item.volume?.toLocaleString() ?? '-'}
          </span>
          <span className="stat-unit">/day</span>
        </div>

        <div className="stat-item">
          <span className="stat-label">BUY LIMIT</span>
          <span className="stat-value">
            {item.buyLimit?.toLocaleString() ?? '-'}
          </span>
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
            <span className="detail-value">
              {item.highAlch ? formatGp(item.highAlch) : '-'}
            </span>
          </div>

          <div className="detail-item">
            <span className="detail-label">Low Alch</span>
            <span className="detail-value">
              {item.lowAlch ? formatGp(item.lowAlch) : '-'}
            </span>
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
        itemIcon={item.icon}
        itemId={item.id}
        itemName={item.name}
        variant="detail"
      />

      <section className="actions-section">
        <a
          className="action-link wiki"
          href={wikiUrl}
          rel="noopener noreferrer"
          target="_blank"
        >
          <svg
            aria-hidden="true"
            fill="currentColor"
            height="16"
            viewBox="0 0 24 24"
            width="16"
          >
            <path d="M14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z" />
            <path d="M5 5v14h14v-7h-2v5H7V7h5V5H5z" />
          </svg>
          Wiki
        </a>
      </section>
    </section>
  );
}
