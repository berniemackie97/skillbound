'use client';

import {
  Fragment,
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import {
  formatGp,
  formatRoi,
  formatTimeAgo,
  getItemIconUrl,
} from '@/lib/trading/ge-service';

import { MobileFilterSheet } from './mobile-filter-sheet';
import { PriceChartPanel } from './price-chart-panel';

export interface ExchangeItem {
  id: number;
  name: string;
  icon: string;
  members: boolean;
  buyLimit: number | null;
  buyPrice: number | null;
  sellPrice: number | null;
  buyPriceTime: string | null;
  sellPriceTime: string | null;
  margin: number | null;
  tax: number | null;
  profit: number | null;
  roiPercent: number | null;
  volume: number | null;
  potentialProfit: number | null;
}

export type SortField =
  | 'name'
  | 'buyPrice'
  | 'sellPrice'
  | 'margin'
  | 'tax'
  | 'profit'
  | 'roiPercent'
  | 'volume'
  | 'buyLimit'
  | 'potentialProfit'
  | 'lastTrade';

export type SortDirection = 'asc' | 'desc';

export type SortState = {
  field: SortField;
  direction: SortDirection;
};
export type ColumnFilterKey =
  | 'buyPrice'
  | 'sellPrice'
  | 'margin'
  | 'profit'
  | 'roi'
  | 'volume'
  | 'potentialProfit';

interface SortHeaderProps {
  field: SortField;
  label: string;
  className?: string;
  filterKey?: ColumnFilterKey;
  sorts: SortState[];
  openFilter: ColumnFilterKey | null;
  columnFilters: Record<ColumnFilterKey, { min: string; max: string }>;
  onSort: (field: SortField, additive: boolean) => void;
  onOpenFilter: (key: ColumnFilterKey | null) => void;
  onColumnFilterChange: (
    key: ColumnFilterKey,
    field: 'min' | 'max',
    value: string
  ) => void;
  onColumnFilterApply: (key?: ColumnFilterKey) => void;
  onColumnFilterClear: (key: ColumnFilterKey) => void;
}

const SortHeader = memo(function SortHeader({
  field,
  label,
  className = '',
  filterKey,
  sorts,
  openFilter,
  columnFilters,
  onSort,
  onOpenFilter,
  onColumnFilterChange,
  onColumnFilterApply,
  onColumnFilterClear,
}: SortHeaderProps) {
  const sortIndex = sorts.findIndex((sort) => sort.field === field);
  const sort = sortIndex === -1 ? null : sorts[sortIndex];
  const inputMinRef = useRef<HTMLInputElement>(null);
  const inputMaxRef = useRef<HTMLInputElement>(null);

  // Focus the min input when filter opens
  useEffect(() => {
    if (filterKey && openFilter === filterKey && inputMinRef.current) {
      inputMinRef.current.focus();
    }
  }, [filterKey, openFilter]);

  return (
    <th
      className={`sortable ${sort ? 'sorted' : ''} ${className}`}
      onClick={(event) => onSort(field, event.shiftKey)}
    >
      <span className="header-grid">
        <span className="header-label">{label}</span>
        <span className="header-actions">
          {sort && (
            <span className="sort-indicator">
              {sort.direction === 'desc' ? '↓' : '↑'}
              {sorts.length > 1 && (
                <span className="sort-rank">{sortIndex + 1}</span>
              )}
            </span>
          )}
          {filterKey && (
            <button
              aria-label={`Filter ${label}`}
              className={`filter-btn ${columnFilters[filterKey].min || columnFilters[filterKey].max ? 'active' : ''}`}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onOpenFilter(openFilter === filterKey ? null : filterKey);
              }}
            >
              <svg
                fill="currentColor"
                height="16"
                viewBox="0 0 24 24"
                width="16"
              >
                <path d="M3 4h18l-7 8v6l-4 2v-8L3 4z" />
              </svg>
            </button>
          )}
        </span>
      </span>
      {filterKey && openFilter === filterKey && (
        <div
          className="filter-popover"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="filter-title">Filter {label}</div>
          <div className="filter-inputs">
            <input
              ref={inputMinRef}
              placeholder="Min"
              type="text"
              value={columnFilters[filterKey].min}
              onChange={(event) =>
                onColumnFilterChange(filterKey, 'min', event.target.value)
              }
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  onColumnFilterApply(filterKey);
                  onOpenFilter(null);
                }
                if (event.key === 'Escape') {
                  onOpenFilter(null);
                }
              }}
            />
            <input
              ref={inputMaxRef}
              placeholder="Max"
              type="text"
              value={columnFilters[filterKey].max}
              onChange={(event) =>
                onColumnFilterChange(filterKey, 'max', event.target.value)
              }
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  onColumnFilterApply(filterKey);
                  onOpenFilter(null);
                }
                if (event.key === 'Escape') {
                  onOpenFilter(null);
                }
              }}
            />
          </div>
          <div className="filter-actions">
            <button
              className="filter-clear"
              type="button"
              onClick={() => {
                onColumnFilterClear(filterKey);
                onOpenFilter(null);
              }}
            >
              Clear
            </button>
            <button
              className="filter-apply"
              type="button"
              onClick={() => {
                onColumnFilterApply(filterKey);
                onOpenFilter(null);
              }}
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </th>
  );
});

interface ExchangeTableProps {
  items: ExchangeItem[];
  favorites: Set<number>;
  onToggleFavorite: (itemId: number) => void;
  onItemClick?: (item: ExchangeItem) => void;
  sorts: SortState[];
  onSort: (field: SortField, additive: boolean) => void;
  currentPage: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
  columnFilters: Record<ColumnFilterKey, { min: string; max: string }>;
  onColumnFilterChange: (
    key: ColumnFilterKey,
    field: 'min' | 'max',
    value: string
  ) => void;
  onColumnFilterApply: (key?: ColumnFilterKey) => void;
  onColumnFilterClear: (key: ColumnFilterKey) => void;
}

function ExchangeTableBase({
  items,
  favorites,
  onToggleFavorite,
  onItemClick,
  sorts,
  onSort,
  currentPage,
  totalPages,
  total,
  onPageChange,
  columnFilters,
  onColumnFilterChange,
  onColumnFilterApply,
  onColumnFilterClear,
}: ExchangeTableProps) {
  const [expandedItemId, setExpandedItemId] = useState<number | null>(null);
  const [openFilter, setOpenFilter] = useState<ColumnFilterKey | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const tableRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef<Map<number, HTMLTableRowElement>>(new Map());
  const rowPositions = useRef<Map<number, number>>(new Map());
  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const cardPositions = useRef<Map<number, number>>(new Map());
  const [allowMotion, setAllowMotion] = useState(true);

  useEffect(() => {
    setNow(new Date());
    const intervalId = window.setInterval(() => {
      setNow(new Date());
    }, 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(max-width: 768px)');
    const handleChange = () => setIsMobile(media.matches);
    handleChange();
    if (media.addEventListener) {
      media.addEventListener('change', handleChange);
      return () => media.removeEventListener('change', handleChange);
    }
    media.addListener(handleChange);
    return () => media.removeListener(handleChange);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const widthMedia = window.matchMedia('(max-width: 640px)');
    const heightMedia = window.matchMedia('(max-height: 520px)');
    const handleChange = () =>
      setIsCompact(widthMedia.matches || heightMedia.matches);
    handleChange();
    if (widthMedia.addEventListener) {
      widthMedia.addEventListener('change', handleChange);
      heightMedia.addEventListener('change', handleChange);
      return () => {
        widthMedia.removeEventListener('change', handleChange);
        heightMedia.removeEventListener('change', handleChange);
      };
    }
    widthMedia.addListener(handleChange);
    heightMedia.addListener(handleChange);
    return () => {
      widthMedia.removeListener(handleChange);
      heightMedia.removeListener(handleChange);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const motionMedia = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = () => {
      setAllowMotion(!motionMedia.matches);
    };
    handleChange();
    if (motionMedia.addEventListener) {
      motionMedia.addEventListener('change', handleChange);
      return () => motionMedia.removeEventListener('change', handleChange);
    }
    motionMedia.addListener(handleChange);
    return () => motionMedia.removeListener(handleChange);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!tableRef.current) return;
      const target = event.target as Node;
      if (
        tableRef.current.contains(target) &&
        (target as HTMLElement).closest(
          '.filter-popover, .filter-btn, .mobile-filter-sheet, .mobile-filter-backdrop'
        )
      ) {
        return;
      }
      setOpenFilter(null);
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useLayoutEffect(() => {
    const shouldAnimate = allowMotion && items.length <= 120;
    if (!shouldAnimate) {
      rowRefs.current.clear();
      rowPositions.current.clear();
      cardRefs.current.clear();
      cardPositions.current.clear();
      return;
    }

    const overscan = 120;
    const viewportTop = -overscan;
    const viewportBottom = window.innerHeight + overscan;
    const isVisible = (rect: DOMRect) =>
      rect.bottom >= viewportTop && rect.top <= viewportBottom;

    if (isCompact) {
      rowRefs.current.clear();
      rowPositions.current.clear();
      const newPositions = new Map<number, number>();
      cardRefs.current.forEach((node, id) => {
        const rect = node.getBoundingClientRect();
        if (!isVisible(rect)) return;
        newPositions.set(id, rect.top);
      });

      const prevPositions = cardPositions.current;
      newPositions.forEach((next, id) => {
        const prev = prevPositions.get(id);
        if (prev === undefined || next === undefined) return;
        const delta = prev - next;
        if (delta === 0) return;
        const node = cardRefs.current.get(id);
        if (!node) return;
        node.style.transition = 'transform 0s';
        node.style.transform = `translateY(${delta}px)`;
        requestAnimationFrame(() => {
          node.style.transition =
            'transform 220ms cubic-bezier(0.22, 0.61, 0.36, 1), box-shadow 0.2s ease';
          node.style.transform = '';
          window.setTimeout(() => {
            node.style.transition = '';
          }, 260);
        });
      });

      cardPositions.current = newPositions;
      return;
    }

    cardRefs.current.clear();
    cardPositions.current.clear();

    const newPositions = new Map<number, number>();
    rowRefs.current.forEach((node, id) => {
      const rect = node.getBoundingClientRect();
      if (!isVisible(rect)) return;
      newPositions.set(id, rect.top);
    });

    const prevPositions = rowPositions.current;
    newPositions.forEach((next, id) => {
      const prev = prevPositions.get(id);
      if (prev === undefined || next === undefined) return;
      const delta = prev - next;
      if (delta === 0) return;
      const node = rowRefs.current.get(id);
      if (!node) return;
      node.style.transition = 'transform 0s';
      node.style.transform = `translateY(${delta}px)`;
      requestAnimationFrame(() => {
        node.style.transition =
          'transform 220ms cubic-bezier(0.22, 0.61, 0.36, 1)';
        node.style.transform = '';
      });
    });

    rowPositions.current = newPositions;
  }, [allowMotion, isCompact, items]);

  const handleSort = useCallback(
    (field: SortField, additive: boolean) => {
      onSort(field, additive);
    },
    [onSort]
  );

  const handleRowClick = useCallback(
    (item: ExchangeItem) => {
      if (onItemClick) {
        onItemClick(item);
      }
    },
    [onItemClick]
  );

  const handleExpandClick = useCallback(
    (e: React.MouseEvent, itemId: number) => {
      e.stopPropagation();
      setExpandedItemId((prev) => (prev === itemId ? null : itemId));
    },
    []
  );

  const handleOpenFilter = useCallback((key: ColumnFilterKey | null) => {
    setOpenFilter(key);
  }, []);

  const filterLabels: Record<ColumnFilterKey, string> = {
    buyPrice: 'Buy Price',
    sellPrice: 'Sell Price',
    margin: 'Margin',
    profit: 'Profit',
    roi: 'ROI %',
    volume: 'Volume',
    potentialProfit: 'Pot. Profit',
  };

  // Common props for all SortHeader components
  const sortHeaderProps = {
    sorts,
    openFilter,
    columnFilters,
    onSort: handleSort,
    onOpenFilter: handleOpenFilter,
    onColumnFilterChange,
    onColumnFilterApply,
    onColumnFilterClear,
  };

  const getLastTradeTime = (item: ExchangeItem): Date | null => {
    const buyTime = item.buyPriceTime ? new Date(item.buyPriceTime) : null;
    const sellTime = item.sellPriceTime ? new Date(item.sellPriceTime) : null;
    if (!buyTime && !sellTime) return null;
    if (!buyTime) return sellTime;
    if (!sellTime) return buyTime;
    return buyTime > sellTime ? buyTime : sellTime;
  };

  if (isCompact) {
    return (
      <div ref={tableRef} className="exchange-table-container compact">
        <div className="exchange-mobile-status">
          <span aria-hidden="true" className="update-dot" />
          Live prices
        </div>

        <div className="exchange-card-list">
          {items.map((item) => {
            const isFavorite = favorites.has(item.id);
            const lastTrade = now
              ? formatTimeAgo(getLastTradeTime(item), now)
              : '-';

            return (
              <div
                key={item.id}
                ref={(node) => {
                  if (!node) {
                    cardRefs.current.delete(item.id);
                  } else {
                    cardRefs.current.set(item.id, node);
                  }
                }}
                className="exchange-card"
                role="button"
                tabIndex={0}
                onClick={() => handleRowClick(item)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    handleRowClick(item);
                  }
                }}
              >
                <div className="exchange-card-header">
                  <button
                    aria-label={isFavorite ? 'Unstar' : 'Star'}
                    className={`star-btn ${isFavorite ? 'active' : ''}`}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggleFavorite(item.id);
                    }}
                  >
                    <svg height="18" viewBox="0 0 24 24" width="18">
                      <path
                        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                        fill={isFavorite ? '#ffd700' : 'none'}
                        stroke={isFavorite ? '#ffd700' : 'currentColor'}
                        strokeWidth="2"
                      />
                    </svg>
                  </button>
                  <img
                    alt=""
                    className="item-icon"
                    height={28}
                    loading="lazy"
                    src={getItemIconUrl(item.icon)}
                    width={28}
                  />
                  <div className="exchange-card-title">
                    <span className="item-name">{item.name}</span>
                    <span className="item-meta">
                      {item.members ? 'Members' : 'F2P'} · Limit{' '}
                      {item.buyLimit?.toLocaleString() ?? '—'}
                    </span>
                  </div>
                </div>

                <div className="exchange-card-metrics">
                  <div className="exchange-metric">
                    <span>Buy</span>
                    <strong>
                      {item.buyPrice !== null ? formatGp(item.buyPrice) : '-'}
                    </strong>
                  </div>
                  <div className="exchange-metric">
                    <span>Sell</span>
                    <strong>
                      {item.sellPrice !== null ? formatGp(item.sellPrice) : '-'}
                    </strong>
                  </div>
                  <div className="exchange-metric">
                    <span>Margin</span>
                    <strong>{formatGp(item.margin)}</strong>
                  </div>
                  <div className="exchange-metric">
                    <span>Profit</span>
                    <strong
                      className={
                        item.profit !== null && item.profit >= 0
                          ? 'positive'
                          : 'negative'
                      }
                    >
                      {formatGp(item.profit)}
                    </strong>
                  </div>
                  <div className="exchange-metric">
                    <span>ROI</span>
                    <strong
                      className={
                        item.roiPercent !== null && item.roiPercent >= 0
                          ? 'positive'
                          : 'negative'
                      }
                    >
                      {formatRoi(item.roiPercent)}
                    </strong>
                  </div>
                  <div className="exchange-metric">
                    <span>Volume</span>
                    <strong>{item.volume?.toLocaleString() ?? '-'}</strong>
                  </div>
                </div>

                <div className="exchange-card-footer">
                  <span>Last trade: {lastTrade}</span>
                  <span className="exchange-card-link">View details →</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="table-pagination">
          <span className="pagination-info">
            Showing {(currentPage - 1) * 25 + 1}-
            {Math.min(currentPage * 25, total)} of {total.toLocaleString()}{' '}
            items
          </span>
          <div className="pagination-controls">
            <button
              className="pagination-btn"
              disabled={currentPage <= 1}
              type="button"
              onClick={() => onPageChange(currentPage - 1)}
            >
              ‹
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              return (
                <button
                  key={pageNum}
                  className={`pagination-btn ${currentPage === pageNum ? 'active' : ''}`}
                  type="button"
                  onClick={() => onPageChange(pageNum)}
                >
                  {pageNum}
                </button>
              );
            })}
            {totalPages > 5 && currentPage < totalPages - 2 && (
              <>
                <span className="pagination-ellipsis">...</span>
                <button
                  className="pagination-btn"
                  type="button"
                  onClick={() => onPageChange(totalPages)}
                >
                  {totalPages}
                </button>
              </>
            )}
            <button
              className="pagination-btn"
              disabled={currentPage >= totalPages}
              type="button"
              onClick={() => onPageChange(currentPage + 1)}
            >
              ›
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={tableRef} className="exchange-table-container">
      <table className="exchange-table">
        <colgroup>
          <col className="col-star" />
          <col className="col-expand" />
          <col className="col-name" />
          <col className="col-price" />
          <col className="col-price" />
          <col className="col-margin" />
          <col className="col-tax" />
          <col className="col-profit" />
          <col className="col-roi" />
          <col className="col-volume" />
          <col className="col-limit" />
          <col className="col-potential" />
          <col className="col-time" />
        </colgroup>
        <thead>
          <tr className="update-row">
            <th colSpan={13}>
              <div className="update-indicator">
                <span aria-hidden="true" className="update-dot" />
                Live prices
              </div>
            </th>
          </tr>
          <tr>
            <th aria-label="Favorite" className="col-star"></th>
            <th className="col-expand"></th>
            <SortHeader
              className="col-name"
              field="name"
              label="Name"
              {...sortHeaderProps}
            />
            <SortHeader
              className="col-price"
              field="buyPrice"
              filterKey="buyPrice"
              label="Buy Price"
              {...sortHeaderProps}
            />
            <SortHeader
              className="col-price"
              field="sellPrice"
              filterKey="sellPrice"
              label="Sell Price"
              {...sortHeaderProps}
            />
            <SortHeader
              className="col-margin"
              field="margin"
              filterKey="margin"
              label="Margin"
              {...sortHeaderProps}
            />
            <SortHeader
              className="col-tax"
              field="tax"
              label="Tax"
              {...sortHeaderProps}
            />
            <SortHeader
              className="col-profit"
              field="profit"
              filterKey="profit"
              label="Profit"
              {...sortHeaderProps}
            />
            <SortHeader
              className="col-roi"
              field="roiPercent"
              filterKey="roi"
              label="ROI %"
              {...sortHeaderProps}
            />
            <SortHeader
              className="col-volume"
              field="volume"
              filterKey="volume"
              label="Volume"
              {...sortHeaderProps}
            />
            <SortHeader
              className="col-limit"
              field="buyLimit"
              label="Limit"
              {...sortHeaderProps}
            />
            <SortHeader
              className="col-potential"
              field="potentialProfit"
              filterKey="potentialProfit"
              label="Pot. Profit"
              {...sortHeaderProps}
            />
            <SortHeader
              className="col-time"
              field="lastTrade"
              label="Last"
              {...sortHeaderProps}
            />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const isFavorite = favorites.has(item.id);
            const isExpanded = expandedItemId === item.id;

            return (
              <Fragment key={item.id}>
                <tr
                  ref={(node) => {
                    if (!node) {
                      rowRefs.current.delete(item.id);
                    } else {
                      rowRefs.current.set(item.id, node);
                    }
                  }}
                  className={`item-row ${isExpanded ? 'expanded' : ''}`}
                  onClick={() => handleRowClick(item)}
                >
                  <td className="col-star">
                    <button
                      aria-label={isFavorite ? 'Unstar' : 'Star'}
                      className={`star-btn ${isFavorite ? 'active' : ''}`}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(item.id);
                      }}
                    >
                      <svg height="18" viewBox="0 0 24 24" width="18">
                        <path
                          d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                          fill={isFavorite ? '#ffd700' : 'none'}
                          stroke={isFavorite ? '#ffd700' : 'currentColor'}
                          strokeWidth="2"
                        />
                      </svg>
                    </button>
                  </td>
                  <td className="col-expand">
                    <button
                      aria-label={isExpanded ? 'Collapse' : 'Expand'}
                      className={`expand-btn ${isExpanded ? 'active' : ''}`}
                      type="button"
                      onClick={(e) => handleExpandClick(e, item.id)}
                    >
                      <svg
                        fill="currentColor"
                        height="20"
                        viewBox="0 0 24 24"
                        width="20"
                      >
                        <path d="M7 10l5 5 5-5z" />
                      </svg>
                    </button>
                  </td>
                  <td className="col-name">
                    <div className="item-name-cell">
                      <img
                        alt=""
                        className="item-icon"
                        height={24}
                        loading="lazy"
                        src={getItemIconUrl(item.icon)}
                        width={24}
                      />
                      <span className="item-name">{item.name}</span>
                    </div>
                  </td>
                  <td className="col-price buy">
                    {item.buyPrice !== null ? (
                      <span className="price-cell">
                        <span className="price-indicator buy">▼</span>
                        <span className="price-value">
                          {formatGp(item.buyPrice)}
                        </span>
                      </span>
                    ) : (
                      <span className="price-empty">-</span>
                    )}
                  </td>
                  <td className="col-price sell">
                    {item.sellPrice !== null ? (
                      <span className="price-cell">
                        <span className="price-indicator sell">▲</span>
                        <span className="price-value">
                          {formatGp(item.sellPrice)}
                        </span>
                      </span>
                    ) : (
                      <span className="price-empty">-</span>
                    )}
                  </td>
                  <td className="col-margin">{formatGp(item.margin)}</td>
                  <td className="col-tax">
                    {item.tax !== null ? `-${formatGp(item.tax)}` : '-'}
                  </td>
                  <td
                    className={`col-profit ${item.profit !== null && item.profit >= 0 ? 'positive' : 'negative'}`}
                  >
                    {formatGp(item.profit)}
                  </td>
                  <td
                    className={`col-roi ${item.roiPercent !== null && item.roiPercent >= 0 ? 'positive' : 'negative'}`}
                  >
                    {formatRoi(item.roiPercent)}
                  </td>
                  <td className="col-volume">
                    {item.volume?.toLocaleString() ?? '-'}
                  </td>
                  <td className="col-limit">
                    {item.buyLimit?.toLocaleString() ?? '-'}
                  </td>
                  <td className="col-potential">
                    {formatGp(item.potentialProfit)}
                  </td>
                  <td className="col-time">
                    <span className="time-indicator" />
                    {now ? formatTimeAgo(getLastTradeTime(item), now) : '-'}
                  </td>
                </tr>
                {expandedItemId === item.id && (
                  <tr className="expanded-row">
                    <td colSpan={13}>
                      <div className="expanded-content">
                        <PriceChartPanel
                          itemIcon={item.icon}
                          itemId={item.id}
                          itemName={item.name}
                          variant="table"
                        />
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>

      {isMobile && openFilter && (
        <MobileFilterSheet
          filterKey={openFilter}
          isOpen={Boolean(openFilter)}
          label={filterLabels[openFilter]}
          maxValue={columnFilters[openFilter].max}
          minValue={columnFilters[openFilter].min}
          onApply={() => onColumnFilterApply(openFilter)}
          onClear={() => onColumnFilterClear(openFilter)}
          onClose={() => setOpenFilter(null)}
          onMaxChange={(value) =>
            onColumnFilterChange(openFilter, 'max', value)
          }
          onMinChange={(value) =>
            onColumnFilterChange(openFilter, 'min', value)
          }
        />
      )}

      {/* Pagination */}
      <div className="table-pagination">
        <span className="pagination-info">
          Showing {(currentPage - 1) * 25 + 1}-
          {Math.min(currentPage * 25, total)} of {total.toLocaleString()} items
        </span>
        <div className="pagination-controls">
          <button
            className="pagination-btn"
            disabled={currentPage <= 1}
            type="button"
            onClick={() => onPageChange(currentPage - 1)}
          >
            ‹
          </button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let pageNum: number;
            if (totalPages <= 5) {
              pageNum = i + 1;
            } else if (currentPage <= 3) {
              pageNum = i + 1;
            } else if (currentPage >= totalPages - 2) {
              pageNum = totalPages - 4 + i;
            } else {
              pageNum = currentPage - 2 + i;
            }
            return (
              <button
                key={pageNum}
                className={`pagination-btn ${currentPage === pageNum ? 'active' : ''}`}
                type="button"
                onClick={() => onPageChange(pageNum)}
              >
                {pageNum}
              </button>
            );
          })}
          {totalPages > 5 && currentPage < totalPages - 2 && (
            <>
              <span className="pagination-ellipsis">...</span>
              <button
                className="pagination-btn"
                type="button"
                onClick={() => onPageChange(totalPages)}
              >
                {totalPages}
              </button>
            </>
          )}
          <button
            className="pagination-btn"
            disabled={currentPage >= totalPages}
            type="button"
            onClick={() => onPageChange(currentPage + 1)}
          >
            ›
          </button>
        </div>
      </div>
    </div>
  );
}

export const ExchangeTable = memo(ExchangeTableBase);
