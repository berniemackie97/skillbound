'use client';

import { useMemo } from 'react';

import { calculateGeTax, formatGp } from '@/lib/trading/ge-service';

import { useLiveGeItems } from './use-live-ge-items';

interface InventoryPosition {
  itemId: number;
  itemName: string;
  iconUrl: string;
  remainingQuantity: number;
  averageBuyPrice: number;
  heldValue: number;
}

interface InventorySummary {
  totalPositions: number;
  totalHeldItems: number;
  totalHeldValue: number;
  positions: InventoryPosition[];
}

interface InventoryCardProps {
  inventory: InventorySummary;
  onItemClick?: (itemId: number) => void;
}

export function InventoryCard({ inventory, onItemClick }: InventoryCardProps) {
  const { items: liveItems } = useLiveGeItems(
    inventory.positions.map((pos) => pos.itemId)
  );

  const positionsWithLive = useMemo(() => {
    return inventory.positions.map((position) => {
      const live = liveItems[position.itemId];
      const currentBuy = live?.sellPrice ?? null;
      const currentSell = live?.buyPrice ?? null;
      const margin = live?.margin ?? null;
      const netPerItem =
        currentSell !== null
          ? currentSell - position.averageBuyPrice - calculateGeTax(currentSell)
          : null;
      const netTotal =
        netPerItem !== null ? netPerItem * position.remainingQuantity : null;
      const breakEven =
        position.averageBuyPrice > 0
          ? Math.ceil(
              position.averageBuyPrice / 0.99 > 500_000_000
                ? position.averageBuyPrice + 5_000_000
                : position.averageBuyPrice / 0.99
            )
          : null;

      return {
        ...position,
        live,
        currentBuy,
        currentSell,
        margin,
        netPerItem,
        netTotal,
        breakEven,
      };
    });
  }, [inventory.positions, liveItems]);

  return (
    <div className="inventory-card">
      <div className="inventory-header">
        <h3>Inventory Holdings</h3>
        <span className="card-badge">{inventory.totalPositions} items</span>
      </div>

      <div className="inventory-summary">
        <div className="inventory-summary-item">
          <span className="label">Total Items:</span>
          <span className="value">{inventory.totalHeldItems.toLocaleString()}</span>
        </div>
        <div className="inventory-summary-item">
          <span className="label">Total Value:</span>
          <span className="value">{formatGp(inventory.totalHeldValue)} GP</span>
        </div>
      </div>

      {inventory.positions.length === 0 ? (
        <div className="inventory-empty">
          <p>No items currently held.</p>
          <p className="text-muted">
            Items you buy will appear here until sold.
          </p>
        </div>
      ) : (
        <div className="inventory-list">
          {positionsWithLive.map((position) => {
            const status =
              position.netPerItem === null
                ? 'neutral'
                : position.netPerItem >= 0
                  ? 'positive'
                  : 'negative';
            const statusLabel =
              position.netPerItem === null
                ? 'No live price'
                : position.netPerItem >= 0
                  ? 'In Profit'
                  : 'In Red';

            return (
            <div
              key={position.itemId}
              className="inventory-item"
              role={onItemClick ? 'button' : undefined}
              style={onItemClick ? { cursor: 'pointer' } : undefined}
              tabIndex={onItemClick ? 0 : undefined}
              onClick={() => onItemClick?.(position.itemId)}
            >
              {position.iconUrl && (
                <img
                  alt=""
                  className="inventory-item-icon"
                  height={32}
                  loading="lazy"
                  src={position.iconUrl}
                  width={32}
                />
              )}
              <div className="inventory-item-info">
                <span className="inventory-item-name">{position.itemName}</span>
                <div className="inventory-item-meta">
                  <span className="inventory-item-qty">
                    x{position.remainingQuantity.toLocaleString()}
                  </span>
                  <span>@</span>
                  <span>{formatGp(position.averageBuyPrice)} avg</span>
                </div>
                <div className="inventory-item-live">
                  <span className={`inventory-pill ${status}`}>{statusLabel}</span>
                  <span>Buy {formatGp(position.currentBuy)}</span>
                  <span>Sell {formatGp(position.currentSell)}</span>
                  <span>Margin {formatGp(position.margin)}</span>
                  {position.breakEven !== null && (
                    <span>Break-even {formatGp(position.breakEven)}</span>
                  )}
                </div>
              </div>
              <span className="inventory-item-value">
                <span className="inventory-held">
                  {formatGp(position.heldValue)}
                </span>
                {position.netTotal !== null && (
                  <span className={`inventory-pnl ${status}`}>
                    {position.netTotal >= 0 ? '+' : ''}
                    {formatGp(position.netTotal)}
                  </span>
                )}
              </span>
            </div>
          );
          })}
        </div>
      )}
    </div>
  );
}
