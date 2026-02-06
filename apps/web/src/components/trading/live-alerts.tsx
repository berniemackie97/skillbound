'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo } from 'react';

import {
  calculateGeTax,
  formatGp,
  getItemIconUrl,
} from '@/lib/trading/ge-service';

import { useLiveGeItems } from './use-live-ge-items';

type InventoryPosition = {
  itemId: number;
  itemName: string;
  iconUrl: string;
  remainingQuantity: number;
  averageBuyPrice: number;
};

type InventorySummary = {
  positions: InventoryPosition[];
};

type WatchItem = {
  id: string;
  itemId: number;
  itemName: string;
  alertOnMargin: number | null;
  alertOnBuyPrice: number | null;
  alertOnSellPrice: number | null;
  alertOnVolume: number | null;
  isActive: boolean;
};

type LiveAlert = {
  key: string;
  itemId: number;
  itemName: string;
  icon: string | null;
  status: 'positive' | 'negative' | 'neutral';
  headline: string;
  details: string[];
};

type LiveAlertsProps = {
  inventory: InventorySummary;
  watchItems: WatchItem[];
};

const PRICE_SPIKE_PCT = 0.08;
const WIDE_MARGIN_PCT = 0.03;

export function LiveAlerts({ inventory, watchItems }: LiveAlertsProps) {
  const ids = useMemo(() => {
    const set = new Set<number>();
    inventory.positions.forEach((pos) => set.add(pos.itemId));
    watchItems.forEach((item) => set.add(item.itemId));
    return Array.from(set);
  }, [inventory.positions, watchItems]);

  const { items: liveItems } = useLiveGeItems(ids);

  const alerts = useMemo(() => {
    const results: LiveAlert[] = [];

    inventory.positions.forEach((position) => {
      const live = liveItems[position.itemId];
      if (!live) return;

      const details: string[] = [];
      if (live.avgHighPrice && live.buyPrice) {
        const delta = (live.buyPrice - live.avgHighPrice) / live.avgHighPrice;
        if (delta >= PRICE_SPIKE_PCT) {
          details.push(`Price spike +${(delta * 100).toFixed(1)}%`);
        } else if (delta <= -PRICE_SPIKE_PCT) {
          details.push(`Price dip ${(delta * 100).toFixed(1)}%`);
        }
      }

      if (live.margin && live.avgHighPrice) {
        const marginPct = live.margin / live.avgHighPrice;
        if (marginPct >= WIDE_MARGIN_PCT) {
          details.push(`Wide margin ${formatGp(live.margin)}`);
        }
      }

      if (live.volume5m && live.volume1h) {
        const expected = live.volume1h / 12;
        if (expected > 0 && live.volume5m > expected * 1.8) {
          details.push(`Volume spike ${live.volume5m.toLocaleString()}`);
        }
      }

      const currentSell = live.buyPrice ?? null;
      const netPerItem =
        currentSell !== null
          ? currentSell - position.averageBuyPrice - calculateGeTax(currentSell)
          : null;
      const netTotal =
        netPerItem !== null ? netPerItem * position.remainingQuantity : null;

      if (netTotal !== null) {
        details.unshift(
          `Position ${netTotal >= 0 ? 'green' : 'red'}: ${
            netTotal >= 0 ? '+' : ''
          }${formatGp(netTotal)}`
        );
      }

      if (details.length === 0) return;

      results.push({
        key: `inv-${position.itemId}`,
        itemId: position.itemId,
        itemName: position.itemName,
        icon: position.iconUrl || null,
        status:
          netTotal === null
            ? 'neutral'
            : netTotal >= 0
              ? 'positive'
              : 'negative',
        headline: 'Inventory signal',
        details,
      });
    });

    watchItems.forEach((watch) => {
      if (!watch.isActive) return;
      const live = liveItems[watch.itemId];
      if (!live) return;

      const details: string[] = [];
      if (watch.alertOnMargin && live.margin !== null) {
        if (live.margin >= watch.alertOnMargin) {
          details.push(`Margin ≥ ${formatGp(watch.alertOnMargin)}`);
        }
      }
      if (watch.alertOnBuyPrice && live.buyPrice !== null) {
        if (live.buyPrice <= watch.alertOnBuyPrice) {
          details.push(`Buy ≤ ${formatGp(watch.alertOnBuyPrice)}`);
        }
      }
      if (watch.alertOnSellPrice && live.sellPrice !== null) {
        if (live.sellPrice >= watch.alertOnSellPrice) {
          details.push(`Sell ≥ ${formatGp(watch.alertOnSellPrice)}`);
        }
      }
      if (watch.alertOnVolume && live.volume !== null) {
        if (live.volume >= watch.alertOnVolume) {
          details.push(`Vol ≥ ${watch.alertOnVolume.toLocaleString()}`);
        }
      }

      if (live.avgHighPrice && live.buyPrice) {
        const delta = (live.buyPrice - live.avgHighPrice) / live.avgHighPrice;
        if (delta >= PRICE_SPIKE_PCT) {
          details.push(`Price spike +${(delta * 100).toFixed(1)}%`);
        } else if (delta <= -PRICE_SPIKE_PCT) {
          details.push(`Price dip ${(delta * 100).toFixed(1)}%`);
        }
      }

      if (live.margin && live.avgHighPrice) {
        const marginPct = live.margin / live.avgHighPrice;
        if (marginPct >= WIDE_MARGIN_PCT) {
          details.push(`Wide margin ${formatGp(live.margin)}`);
        }
      }

      if (live.volume5m && live.volume1h) {
        const expected = live.volume1h / 12;
        if (expected > 0 && live.volume5m > expected * 1.8) {
          details.push(`Volume spike ${live.volume5m.toLocaleString()}`);
        }
      }

      if (details.length === 0) return;

      results.push({
        key: `watch-${watch.id}`,
        itemId: watch.itemId,
        itemName: watch.itemName,
        icon: live.icon ?? null,
        status: details.some((detail) => detail.includes('dip'))
          ? 'negative'
          : 'positive',
        headline: 'Watchlist alert',
        details,
      });
    });

    return results;
  }, [inventory.positions, liveItems, watchItems]);

  return (
    <div className="tracker-card live-alerts-card">
      <div className="tracker-card-header">
        <h3>Live Alerts</h3>
        <span className="card-subtitle">Inventory + Watchlist</span>
      </div>

      {alerts.length === 0 ? (
        <div className="live-alerts-empty">
          <p>No alerts yet.</p>
          <p className="text-muted">
            We’ll flag notable price moves, margin spikes, and watch thresholds.
          </p>
        </div>
      ) : (
        <ul className="live-alerts-list">
          {alerts.map((alert) => (
            <li key={alert.key} className={`live-alert ${alert.status}`}>
              <div className="live-alert-header">
                {alert.icon ? (
                  <Image
                    alt=""
                    className="live-alert-icon"
                    height={28}
                    unoptimized={alert.icon.startsWith('data:')}
                    width={28}
                    src={
                      alert.icon.startsWith('http') ||
                      alert.icon.startsWith('data:')
                        ? alert.icon
                        : getItemIconUrl(alert.icon)
                    }
                  />
                ) : (
                  <span className="live-alert-icon placeholder" />
                )}
                <div className="live-alert-title">
                  <Link href={`/trading/item/${alert.itemId}`}>
                    {alert.itemName}
                  </Link>
                  <span className="live-alert-tag">{alert.headline}</span>
                </div>
              </div>
              <div className="live-alert-details">
                {alert.details.map((detail) => (
                  <span key={detail} className="live-alert-detail">
                    {detail}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
