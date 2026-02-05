'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { formatGp, getItemIconUrl } from '@/lib/trading/ge-service';

import { ItemSearch, type ItemSearchResult } from '../ge/item-search';

import { useLiveGeItems } from './use-live-ge-items';

interface ErrorResponse {
  detail?: string;
}

type WatchItem = {
  id: string;
  itemId: number;
  itemName: string;
  alertOnMargin: number | null;
  alertOnBuyPrice: number | null;
  alertOnSellPrice: number | null;
  alertOnVolume: number | null;
  isActive: boolean;
  notes: string | null;
};

type WatchListProps = {
  characterId: string;
  items: WatchItem[];
};

type FavoriteItem = {
  id: number;
  name: string;
  icon?: string | null;
};

const FAVORITES_STORAGE_KEY = 'skillbound:ge-favorites';
const FAVORITES_META_STORAGE_KEY = 'skillbound:ge-favorites-meta';

export function WatchList({ characterId, items }: WatchListProps) {
  const router = useRouter();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [favoriteItems, setFavoriteItems] = useState<FavoriteItem[]>([]);
  const syncingFavoritesRef = useRef<Set<number>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState({
    alertOnMargin: '',
    alertOnBuyPrice: '',
    alertOnSellPrice: '',
    alertOnVolume: '',
    notes: '',
  });

  // Add form state
  const [itemId, setItemId] = useState('');
  const [itemName, setItemName] = useState('');
  const [alertOnMargin, setAlertOnMargin] = useState('');
  const [alertOnBuyPrice, setAlertOnBuyPrice] = useState('');
  const [alertOnSellPrice, setAlertOnSellPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadFavorites = () => {
      try {
        const storedMeta = localStorage.getItem(FAVORITES_META_STORAGE_KEY);
        if (storedMeta) {
          const meta = JSON.parse(storedMeta) as Record<
            number,
            { id: number; name: string; icon?: string }
          >;
          const values = Object.values(meta).map((entry) => ({
            id: entry.id,
            name: entry.name,
            icon: entry.icon ?? null,
          }));
          setFavoriteItems(values);
          return;
        }
        const storedIds = localStorage.getItem(FAVORITES_STORAGE_KEY);
        if (storedIds) {
          const ids = JSON.parse(storedIds) as number[];
          setFavoriteItems(ids.map((id) => ({ id, name: `Item #${id}` })));
        }
      } catch {
        // Ignore localStorage errors
      }
    };

    loadFavorites();
    const handleStorage = (event: StorageEvent) => {
      if (
        event.key === FAVORITES_STORAGE_KEY ||
        event.key === FAVORITES_META_STORAGE_KEY
      ) {
        loadFavorites();
      }
    };
    const handleFavoritesEvent = () => loadFavorites();
    window.addEventListener('storage', handleStorage);
    window.addEventListener('ge-favorites-updated', handleFavoritesEvent);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('ge-favorites-updated', handleFavoritesEvent);
    };
  }, []);

  useEffect(() => {
    if (favoriteItems.length === 0) return;
    const watchedIds = new Set(items.map((item) => item.itemId));
    const missing = favoriteItems.filter((item) => !watchedIds.has(item.id));
    if (missing.length === 0) return;

    const toSync = missing.filter(
      (item) => !syncingFavoritesRef.current.has(item.id)
    );
    if (toSync.length === 0) return;

    toSync.forEach((item) => syncingFavoritesRef.current.add(item.id));

    const sync = async () => {
      await Promise.all(
        toSync.map(async (item) => {
          try {
            await fetch(`/api/characters/${characterId}/watchlist`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ itemId: item.id, itemName: item.name }),
            });
          } catch {
            // Ignore sync errors per item
          }
        })
      );
      router.refresh();
    };

    void sync();
  }, [characterId, favoriteItems, items, router]);

  const liveIds = useMemo(
    () =>
      Array.from(
        new Set([
          ...items.map((item) => item.itemId),
          ...favoriteItems.map((item) => item.id),
        ])
      ),
    [favoriteItems, items]
  );
  const { items: liveItems } = useLiveGeItems(liveIds);

  const filteredWatchItems = useMemo(() => {
    if (!filterText.trim()) return items;
    const needle = filterText.toLowerCase();
    return items.filter((item) => item.itemName.toLowerCase().includes(needle));
  }, [filterText, items]);

  const removeFavoriteLocal = (itemIdToRemove: number) => {
    try {
      const storedFavorites = localStorage.getItem(FAVORITES_STORAGE_KEY);
      if (storedFavorites) {
        const ids = new Set(JSON.parse(storedFavorites) as number[]);
        if (ids.delete(itemIdToRemove)) {
          localStorage.setItem(
            FAVORITES_STORAGE_KEY,
            JSON.stringify(Array.from(ids))
          );
        }
      }
      const storedMeta = localStorage.getItem(FAVORITES_META_STORAGE_KEY);
      if (storedMeta) {
        const meta = JSON.parse(storedMeta) as Record<
          number,
          { id: number; name: string; icon?: string }
        >;
        if (meta[itemIdToRemove]) {
          delete meta[itemIdToRemove];
          localStorage.setItem(
            FAVORITES_META_STORAGE_KEY,
            JSON.stringify(meta)
          );
        }
      }
      window.dispatchEvent(new Event('ge-favorites-updated'));
    } catch {
      // Ignore localStorage errors
    }
  };

  async function handleRemove(watchItemId: string, itemIdToRemove: number) {
    if (!window.confirm('Remove this item from your watch list?')) {
      return;
    }

    setRemovingId(watchItemId);
    try {
      const response = await fetch(`/api/characters/${characterId}/watchlist`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ watchItemId }),
      });

      if (response.ok) {
        removeFavoriteLocal(itemIdToRemove);
        router.refresh();
      }
    } finally {
      setRemovingId(null);
    }
  }

  async function handleToggleActive(
    watchItemId: string,
    currentlyActive: boolean
  ) {
    try {
      await fetch(`/api/characters/${characterId}/watchlist`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          watchItemId,
          isActive: !currentlyActive,
        }),
      });
      router.refresh();
    } catch {
      // Silently fail
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const parsedItemId = parseInt(itemId, 10);
    if (!parsedItemId || !itemName.trim()) {
      setError('Item ID and name are required.');
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch(`/api/characters/${characterId}/watchlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: parsedItemId,
          itemName: itemName.trim(),
          alertOnMargin: alertOnMargin
            ? parseInt(alertOnMargin, 10)
            : undefined,
          alertOnBuyPrice: alertOnBuyPrice
            ? parseInt(alertOnBuyPrice, 10)
            : undefined,
          alertOnSellPrice: alertOnSellPrice
            ? parseInt(alertOnSellPrice, 10)
            : undefined,
          notes: notes.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as ErrorResponse;
        setError(data.detail ?? 'Failed to add item.');
        setIsSubmitting(false);
        return;
      }

      // Reset form
      setItemId('');
      setItemName('');
      setAlertOnMargin('');
      setAlertOnBuyPrice('');
      setAlertOnSellPrice('');
      setNotes('');
      setShowAddForm(false);
      router.refresh();
    } catch {
      setError('Failed to add item.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const beginEdit = (item: WatchItem) => {
    setEditingId(item.id);
    setEditFields({
      alertOnMargin: item.alertOnMargin?.toString() ?? '',
      alertOnBuyPrice: item.alertOnBuyPrice?.toString() ?? '',
      alertOnSellPrice: item.alertOnSellPrice?.toString() ?? '',
      alertOnVolume: item.alertOnVolume?.toString() ?? '',
      notes: item.notes ?? '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditFields({
      alertOnMargin: '',
      alertOnBuyPrice: '',
      alertOnSellPrice: '',
      alertOnVolume: '',
      notes: '',
    });
  };

  const saveEdit = async (itemId: string) => {
    try {
      await fetch(`/api/characters/${characterId}/watchlist`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          watchItemId: itemId,
          alertOnMargin: editFields.alertOnMargin
            ? parseInt(editFields.alertOnMargin, 10)
            : null,
          alertOnBuyPrice: editFields.alertOnBuyPrice
            ? parseInt(editFields.alertOnBuyPrice, 10)
            : null,
          alertOnSellPrice: editFields.alertOnSellPrice
            ? parseInt(editFields.alertOnSellPrice, 10)
            : null,
          alertOnVolume: editFields.alertOnVolume
            ? parseInt(editFields.alertOnVolume, 10)
            : null,
          notes: editFields.notes.trim() || null,
        }),
      });
      router.refresh();
      cancelEdit();
    } catch {
      // Ignore edit errors
    }
  };

  const handleSearchSelect = (selected: ItemSearchResult) => {
    setItemId(String(selected.id));
    setItemName(selected.name);
  };

  return (
    <div className="watch-list">
      <div className="watch-list-header">
        <h3>Watch List</h3>
        <button
          className="button ghost small"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          {showAddForm ? 'Cancel' : '+ Add Item'}
        </button>
      </div>
      <p className="watch-list-hint">
        Pause disables alerts without removing the item. Remove deletes it from
        your list.
      </p>

      <div className="watch-list-search">
        <input
          placeholder="Filter watch list..."
          type="text"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
        />
      </div>

      {showAddForm && (
        <form className="watch-add-form" onSubmit={handleAdd}>
          <div className="form-row">
            <label className="form-field">
              <span>Item</span>
              <ItemSearch
                placeholder="Search items..."
                onSelect={handleSearchSelect}
              />
            </label>
            <label className="form-field flex-grow">
              <span>Selected Item</span>
              <input
                readOnly
                placeholder="Select from search..."
                type="text"
                value={itemName}
              />
            </label>
          </div>

          <div className="form-row">
            <label className="form-field">
              <span>Alert on margin (GP)</span>
              <input
                placeholder="Optional"
                type="number"
                value={alertOnMargin}
                onChange={(e) => setAlertOnMargin(e.target.value)}
              />
            </label>
            <label className="form-field">
              <span>Alert buy price ≤</span>
              <input
                placeholder="Optional"
                type="number"
                value={alertOnBuyPrice}
                onChange={(e) => setAlertOnBuyPrice(e.target.value)}
              />
            </label>
            <label className="form-field">
              <span>Alert sell price ≥</span>
              <input
                placeholder="Optional"
                type="number"
                value={alertOnSellPrice}
                onChange={(e) => setAlertOnSellPrice(e.target.value)}
              />
            </label>
          </div>

          <label className="form-field">
            <span>Notes</span>
            <input
              placeholder="Optional notes..."
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>

          <button className="button" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Adding...' : 'Add to Watch List'}
          </button>

          {error && <div className="error">{error}</div>}
        </form>
      )}

      {items.length === 0 && favoriteItems.length === 0 ? (
        <div className="empty-state">
          <p>No items in your watch list.</p>
          <p className="text-muted">
            Add items to track their prices and get alerts.
          </p>
        </div>
      ) : (
        <ul className="watch-items">
          {filteredWatchItems.map((item) => {
            const geItem = liveItems[item.itemId];
            const alertReasons: string[] = [];

            if (item.isActive && geItem) {
              if (item.alertOnMargin && geItem.margin !== null) {
                if (geItem.margin >= item.alertOnMargin) {
                  alertReasons.push(`Margin ≥ ${formatGp(item.alertOnMargin)}`);
                }
              }
              if (item.alertOnBuyPrice && geItem.buyPrice !== null) {
                if (geItem.buyPrice <= item.alertOnBuyPrice) {
                  alertReasons.push(`Buy ≤ ${formatGp(item.alertOnBuyPrice)}`);
                }
              }
              if (item.alertOnSellPrice && geItem.sellPrice !== null) {
                if (geItem.sellPrice >= item.alertOnSellPrice) {
                  alertReasons.push(
                    `Sell ≥ ${formatGp(item.alertOnSellPrice)}`
                  );
                }
              }
              if (item.alertOnVolume && geItem.volume !== null) {
                if (geItem.volume >= item.alertOnVolume) {
                  alertReasons.push(
                    `Vol ≥ ${item.alertOnVolume.toLocaleString()}`
                  );
                }
              }

              if (geItem.avgHighPrice && geItem.buyPrice) {
                const delta =
                  (geItem.buyPrice - geItem.avgHighPrice) / geItem.avgHighPrice;
                if (delta >= 0.08) {
                  alertReasons.push(
                    `Price spike +${(delta * 100).toFixed(1)}%`
                  );
                } else if (delta <= -0.08) {
                  alertReasons.push(`Price dip ${(delta * 100).toFixed(1)}%`);
                }
              }

              if (geItem.margin && geItem.avgHighPrice) {
                const marginPct = geItem.margin / geItem.avgHighPrice;
                if (marginPct >= 0.03) {
                  alertReasons.push(`Wide margin ${formatGp(geItem.margin)}`);
                }
              }

              if (geItem.volume5m && geItem.volume1h) {
                const expected = geItem.volume1h / 12;
                if (expected > 0 && geItem.volume5m > expected * 1.8) {
                  alertReasons.push(
                    `Volume spike ${geItem.volume5m.toLocaleString()}`
                  );
                }
              }
            }
            return (
              <li
                key={item.id}
                className={`watch-item ${item.isActive ? '' : 'inactive'} ${
                  alertReasons.length > 0 ? 'alert-hit' : ''
                }`}
              >
                <div className="watch-item-info">
                  {geItem?.icon && (
                    <img
                      alt=""
                      className="watch-item-icon"
                      height={28}
                      src={getItemIconUrl(geItem.icon)}
                      width={28}
                    />
                  )}
                  <div className="watch-item-meta">
                    <Link
                      className="item-name"
                      href={`/trading/item/${item.itemId}`}
                    >
                      {item.itemName}
                    </Link>
                    <span className="item-id">#{item.itemId}</span>
                  </div>
                </div>

                <div className="watch-item-stats">
                  <span>Buy {formatGp(geItem?.buyPrice ?? null)}</span>
                  <span>Sell {formatGp(geItem?.sellPrice ?? null)}</span>
                  <span>Margin {formatGp(geItem?.margin ?? null)}</span>
                  <span>Vol {geItem?.volume?.toLocaleString() ?? '-'}</span>
                </div>

                <div className="watch-item-alerts">
                  {item.alertOnMargin && (
                    <span className="alert-badge">
                      Margin ≥ {formatGp(item.alertOnMargin)}
                    </span>
                  )}
                  {item.alertOnBuyPrice && (
                    <span className="alert-badge buy">
                      Buy ≤ {formatGp(item.alertOnBuyPrice)}
                    </span>
                  )}
                  {item.alertOnSellPrice && (
                    <span className="alert-badge sell">
                      Sell ≥ {formatGp(item.alertOnSellPrice)}
                    </span>
                  )}
                  {item.alertOnVolume && (
                    <span className="alert-badge">
                      Vol ≥ {item.alertOnVolume.toLocaleString()}
                    </span>
                  )}
                </div>

                {alertReasons.length > 0 && (
                  <div className="watch-item-live-alerts">
                    <span className="alert-pill">Alert</span>
                    {alertReasons.map((reason) => (
                      <span key={reason} className="alert-reason">
                        {reason}
                      </span>
                    ))}
                  </div>
                )}

                {editingId === item.id && (
                  <div className="watch-item-edit">
                    <div className="form-row">
                      <label className="form-field">
                        <span>Margin ≥</span>
                        <input
                          type="number"
                          value={editFields.alertOnMargin}
                          onChange={(e) =>
                            setEditFields((prev) => ({
                              ...prev,
                              alertOnMargin: e.target.value,
                            }))
                          }
                        />
                      </label>
                      <label className="form-field">
                        <span>Buy ≤</span>
                        <input
                          type="number"
                          value={editFields.alertOnBuyPrice}
                          onChange={(e) =>
                            setEditFields((prev) => ({
                              ...prev,
                              alertOnBuyPrice: e.target.value,
                            }))
                          }
                        />
                      </label>
                      <label className="form-field">
                        <span>Sell ≥</span>
                        <input
                          type="number"
                          value={editFields.alertOnSellPrice}
                          onChange={(e) =>
                            setEditFields((prev) => ({
                              ...prev,
                              alertOnSellPrice: e.target.value,
                            }))
                          }
                        />
                      </label>
                      <label className="form-field">
                        <span>Volume ≥</span>
                        <input
                          type="number"
                          value={editFields.alertOnVolume}
                          onChange={(e) =>
                            setEditFields((prev) => ({
                              ...prev,
                              alertOnVolume: e.target.value,
                            }))
                          }
                        />
                      </label>
                    </div>
                    <label className="form-field">
                      <span>Notes</span>
                      <input
                        type="text"
                        value={editFields.notes}
                        onChange={(e) =>
                          setEditFields((prev) => ({
                            ...prev,
                            notes: e.target.value,
                          }))
                        }
                      />
                    </label>
                    <div className="watch-item-actions">
                      <button
                        className="button ghost small"
                        type="button"
                        onClick={() => saveEdit(item.id)}
                      >
                        Save
                      </button>
                      <button
                        className="button ghost small"
                        type="button"
                        onClick={cancelEdit}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {item.notes && (
                  <div className="watch-item-notes">{item.notes}</div>
                )}

                <div className="watch-item-actions">
                  <button
                    className="button ghost small"
                    title={item.isActive ? 'Pause alerts' : 'Resume alerts'}
                    onClick={() => handleToggleActive(item.id, item.isActive)}
                  >
                    {item.isActive ? 'Pause' : 'Resume'}
                  </button>
                  <button
                    className="button ghost small"
                    onClick={() => beginEdit(item)}
                  >
                    Edit
                  </button>
                  <button
                    className="button ghost small danger"
                    disabled={removingId === item.id}
                    onClick={() => handleRemove(item.id, item.itemId)}
                  >
                    {removingId === item.id ? '...' : 'Remove'}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
