'use client';

import { Fragment, memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { formatGp, formatRoi, formatTimeAgo, getItemIconUrl } from '@/lib/trading/ge-service';

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
  onColumnFilterChange: (key: ColumnFilterKey, field: 'min' | 'max', value: string) => void;
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
              type="button"
              className={`filter-btn ${columnFilters[filterKey].min || columnFilters[filterKey].max ? 'active' : ''}`}
              onClick={(event) => {
                event.stopPropagation();
                onOpenFilter(openFilter === filterKey ? null : filterKey);
              }}
              aria-label={`Filter ${label}`}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M3 4h18l-7 8v6l-4 2v-8L3 4z" />
              </svg>
            </button>
          )}
        </span>
      </span>
      {filterKey && openFilter === filterKey && (
        <div className="filter-popover" onClick={(event) => event.stopPropagation()}>
          <div className="filter-title">Filter {label}</div>
          <div className="filter-inputs">
            <input
              ref={inputMinRef}
              type="text"
              placeholder="Min"
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
              type="text"
              placeholder="Max"
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
              type="button"
              className="filter-clear"
              onClick={() => {
                onColumnFilterClear(filterKey);
                onOpenFilter(null);
              }}
            >
              Clear
            </button>
            <button
              type="button"
              className="filter-apply"
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
  refreshLabel: string;
}

export function ExchangeTable({
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
  refreshLabel,
}: ExchangeTableProps) {
  const [expandedItemId, setExpandedItemId] = useState<number | null>(null);
  const [openFilter, setOpenFilter] = useState<ColumnFilterKey | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const tableRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef<Map<number, HTMLTableRowElement>>(new Map());
  const rowPositions = useRef<Map<number, number>>(new Map());

  useEffect(() => {
    setNow(new Date());
    const intervalId = window.setInterval(() => {
      setNow(new Date());
    }, 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!tableRef.current) return;
      const target = event.target as Node;
      if (
        tableRef.current.contains(target) &&
        (target as HTMLElement).closest('.filter-popover, .filter-btn')
      ) {
        return;
      }
      setOpenFilter(null);
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useLayoutEffect(() => {
    const newPositions = new Map<number, number>();
    rowRefs.current.forEach((node, id) => {
      newPositions.set(id, node.getBoundingClientRect().top);
    });

    const prevPositions = rowPositions.current;
    rowRefs.current.forEach((node, id) => {
      const prev = prevPositions.get(id);
      const next = newPositions.get(id);
      if (prev === undefined || next === undefined) return;
      const delta = prev - next;
      if (delta === 0) return;
      node.style.transition = 'transform 0s';
      node.style.transform = `translateY(${delta}px)`;
      requestAnimationFrame(() => {
        node.style.transition = 'transform 220ms cubic-bezier(0.22, 0.61, 0.36, 1)';
        node.style.transform = '';
      });
    });

    rowPositions.current = newPositions;
  }, [items]);

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

  return (
    <div className="exchange-table-container" ref={tableRef}>
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
                <span className="update-dot" aria-hidden="true" />
                Updating in {refreshLabel}
              </div>
            </th>
          </tr>
          <tr>
            <th className="col-star" aria-label="Favorite"></th>
            <th className="col-expand"></th>
            <SortHeader field="name" label="Name" className="col-name" {...sortHeaderProps} />
            <SortHeader
              field="buyPrice"
              label="Buy Price"
              className="col-price"
              filterKey="buyPrice"
              {...sortHeaderProps}
            />
            <SortHeader
              field="sellPrice"
              label="Sell Price"
              className="col-price"
              filterKey="sellPrice"
              {...sortHeaderProps}
            />
            <SortHeader
              field="margin"
              label="Margin"
              className="col-margin"
              filterKey="margin"
              {...sortHeaderProps}
            />
            <SortHeader field="tax" label="Tax" className="col-tax" {...sortHeaderProps} />
            <SortHeader
              field="profit"
              label="Profit"
              className="col-profit"
              filterKey="profit"
              {...sortHeaderProps}
            />
            <SortHeader
              field="roiPercent"
              label="ROI %"
              className="col-roi"
              filterKey="roi"
              {...sortHeaderProps}
            />
            <SortHeader
              field="volume"
              label="Volume"
              className="col-volume"
              filterKey="volume"
              {...sortHeaderProps}
            />
            <SortHeader field="buyLimit" label="Limit" className="col-limit" {...sortHeaderProps} />
            <SortHeader
              field="potentialProfit"
              label="Pot. Profit"
              className="col-potential"
              filterKey="potentialProfit"
              {...sortHeaderProps}
            />
            <SortHeader field="lastTrade" label="Last" className="col-time" {...sortHeaderProps} />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <Fragment key={item.id}>
              <tr
                className={`item-row ${expandedItemId === item.id ? 'expanded' : ''}`}
                onClick={() => handleRowClick(item)}
                ref={(node) => {
                  if (!node) {
                    rowRefs.current.delete(item.id);
                  } else {
                    rowRefs.current.set(item.id, node);
                  }
                }}
              >
                <td className="col-star">
                  <button
                    type="button"
                    className={`star-btn ${favorites.has(item.id) ? 'active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(item.id);
                    }}
                    aria-label={favorites.has(item.id) ? 'Unstar' : 'Star'}
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18">
                      <path
                        fill={favorites.has(item.id) ? '#ffd700' : 'none'}
                        stroke={favorites.has(item.id) ? '#ffd700' : 'currentColor'}
                        strokeWidth="2"
                        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                      />
                    </svg>
                  </button>
                </td>
                <td className="col-expand">
                  <button
                    type="button"
                    className={`expand-btn ${expandedItemId === item.id ? 'active' : ''}`}
                    onClick={(e) => handleExpandClick(e, item.id)}
                    aria-label={expandedItemId === item.id ? 'Collapse' : 'Expand'}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                      <path d="M7 10l5 5 5-5z" />
                    </svg>
                  </button>
                </td>
                <td className="col-name">
                  <div className="item-name-cell">
                    <img
                      src={getItemIconUrl(item.icon)}
                      alt=""
                      className="item-icon"
                      width={24}
                      height={24}
                      loading="lazy"
                    />
                    <span className="item-name">{item.name}</span>
                  </div>
                </td>
                <td className="col-price buy">
                  {item.buyPrice !== null ? (
                    <span className="price-cell">
                      <span className="price-indicator buy">▼</span>
                      <span className="price-value">{formatGp(item.buyPrice)}</span>
                    </span>
                  ) : (
                    <span className="price-empty">-</span>
                  )}
                </td>
                <td className="col-price sell">
                  {item.sellPrice !== null ? (
                    <span className="price-cell">
                      <span className="price-indicator sell">▲</span>
                      <span className="price-value">{formatGp(item.sellPrice)}</span>
                    </span>
                  ) : (
                    <span className="price-empty">-</span>
                  )}
                </td>
                <td className="col-margin">{formatGp(item.margin)}</td>
                <td className="col-tax">
                  {item.tax !== null ? `-${formatGp(item.tax)}` : '-'}
                </td>
                <td className={`col-profit ${item.profit !== null && item.profit >= 0 ? 'positive' : 'negative'}`}>
                  {formatGp(item.profit)}
                </td>
                <td className={`col-roi ${item.roiPercent !== null && item.roiPercent >= 0 ? 'positive' : 'negative'}`}>
                  {formatRoi(item.roiPercent)}
                </td>
                <td className="col-volume">{item.volume?.toLocaleString() ?? '-'}</td>
                <td className="col-limit">{item.buyLimit?.toLocaleString() ?? '-'}</td>
                <td className="col-potential">{formatGp(item.potentialProfit)}</td>
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
                        itemId={item.id}
                        itemName={item.name}
                        itemIcon={item.icon}
                        variant="table"
                      />
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>

      {/* Pagination */}
      <div className="table-pagination">
        <span className="pagination-info">
          Showing {(currentPage - 1) * 25 + 1}-{Math.min(currentPage * 25, total)} of{' '}
          {total.toLocaleString()} items
        </span>
        <div className="pagination-controls">
          <button
            type="button"
            className="pagination-btn"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
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
                type="button"
                className={`pagination-btn ${currentPage === pageNum ? 'active' : ''}`}
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
                type="button"
                className="pagination-btn"
                onClick={() => onPageChange(totalPages)}
              >
                {totalPages}
              </button>
            </>
          )}
          <button
            type="button"
            className="pagination-btn"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
          >
            ›
          </button>
        </div>
      </div>
    </div>
  );
}
