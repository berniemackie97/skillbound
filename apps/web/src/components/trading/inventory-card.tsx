'use client';

import { formatGp } from '@/lib/trading/ge-service';

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
          {inventory.positions.map((position) => (
            <div
              key={position.itemId}
              className="inventory-item"
              onClick={() => onItemClick?.(position.itemId)}
              role={onItemClick ? 'button' : undefined}
              tabIndex={onItemClick ? 0 : undefined}
              style={onItemClick ? { cursor: 'pointer' } : undefined}
            >
              {position.iconUrl && (
                <img
                  src={position.iconUrl}
                  alt=""
                  className="inventory-item-icon"
                  width={32}
                  height={32}
                  loading="lazy"
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
              </div>
              <span className="inventory-item-value">
                {formatGp(position.heldValue)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
