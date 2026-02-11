import { useEffect, useId, useState } from 'react';

import type { FlipQualityGrade } from '@/lib/trading/flip-scoring';
import { formatGp } from '@/lib/trading/ge-service';

import { REFRESH_OPTIONS } from './exchange-client.constants';
import type {
  ColumnFilterKey,
  ColumnFilterState,
  FlipContext,
  MembersFilter,
  SavedPreset,
  ViewMode,
} from './exchange-client.types';
import { formatCountdown } from './exchange-client.utils';
import { FiltersDropdown } from './filters-dropdown';
import { ItemSearch, type ItemSearchResult } from './item-search';

type SortOption = {
  value: string;
  label: string;
};

interface ExchangeControlsProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onSearchSelect: (item: ItemSearchResult) => void;
  membersFilter: MembersFilter;
  onMembersFilterChange: (value: MembersFilter) => void;
  sortOptions: SortOption[];
  sortValue: string;
  onSortChange: (value: string) => void;
  filters: ColumnFilterState;
  onFilterChange: (
    key: ColumnFilterKey,
    field: 'min' | 'max',
    value: string
  ) => void;
  onApplyFilters: () => void;

  // Multi-preset (replaces old single presetValue + stackPresets)
  activePresets: Set<string>;
  savedPresets: SavedPreset[];
  onTogglePreset: (presetId: string) => void;
  onSavePreset: () => void;

  // Quick filters
  hideNegativeMargin: boolean;
  hideNegativeRoi: boolean;
  onToggleNegative: (type: 'margin' | 'roi') => void;
  minFlipQuality: FlipQualityGrade | null;
  onMinFlipQualityChange: (grade: FlipQualityGrade | null) => void;

  onResetFilters: () => void;

  // Refresh
  refreshInterval: number;
  onRefreshIntervalChange: (value: number) => void;
  isRefreshPaused: boolean;
  onToggleRefreshPaused: () => void;
  nextRefreshAt: number | null;
  lastUpdatedLabel: string;

  // Mobile refine panel
  isRefineOpen: boolean;
  onOpenRefine: () => void;
  onCloseRefine: () => void;

  // Bankroll + Find-a-Flip (signed-in only)
  isSignedIn: boolean;
  flipContext: FlipContext | null;
  onFindMeAFlip: () => void;
  onOpenBankrollSetup: () => void;

  // Smart filter banner
  smartFilterBankroll: number | null;
  onClearSmartFilter: () => void;
}

export function ExchangeControls({
  viewMode,
  onViewModeChange,
  onSearchSelect,
  membersFilter,
  onMembersFilterChange,
  sortOptions,
  sortValue,
  onSortChange,
  filters,
  onFilterChange,
  onApplyFilters,
  activePresets,
  savedPresets,
  onTogglePreset,
  onSavePreset,
  hideNegativeMargin,
  hideNegativeRoi,
  onToggleNegative,
  minFlipQuality,
  onMinFlipQualityChange,
  onResetFilters,
  refreshInterval,
  onRefreshIntervalChange,
  isRefreshPaused,
  onToggleRefreshPaused,
  nextRefreshAt,
  lastUpdatedLabel,
  isRefineOpen,
  onOpenRefine,
  onCloseRefine,
  isSignedIn,
  flipContext,
  onFindMeAFlip,
  onOpenBankrollSetup,
  smartFilterBankroll,
  onClearSmartFilter,
}: ExchangeControlsProps) {
  const idBase = useId();
  const [now, setNow] = useState(() => Date.now());
  const refreshId = `${idBase}-refresh`;

  useEffect(() => {
    const updateNow = () => {
      if (document.visibilityState === 'visible') {
        setNow(Date.now());
      }
    };
    updateNow();
    const intervalId = window.setInterval(updateNow, 1_000);
    document.addEventListener('visibilitychange', updateNow);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', updateNow);
    };
  }, []);

  const nextRefreshLabel = isRefreshPaused
    ? 'Paused'
    : nextRefreshAt
      ? formatCountdown(Math.max(0, nextRefreshAt - now))
      : 'Calculating...';

  const currentBankroll = flipContext?.bankroll?.current ?? null;
  // Only show trading features if the user has a tradable (non-ironman) character
  const hasTradableCharacter = flipContext?.activeCharacterId != null;

  return (
    <div className="exchange-controls">
      {/* Row 1: Search + View + Find-a-Flip */}
      <div className="controls-row controls-top">
        <div className="jump-search">
          <ItemSearch
            className="main-search"
            placeholder="Jump to item..."
            onSelect={onSearchSelect}
          />
        </div>

        <div className="view-selector">
          <button
            className={`view-btn ${viewMode === 'catalog' ? 'active' : ''}`}
            type="button"
            onClick={() => onViewModeChange('catalog')}
          >
            Full Catalog
          </button>
          <button
            className={`view-btn ${viewMode === 'favorites' ? 'active' : ''}`}
            type="button"
            onClick={() => onViewModeChange('favorites')}
          >
            <svg fill="currentColor" height="14" viewBox="0 0 24 24" width="14">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            Favorites
          </button>
        </div>

        {isSignedIn && hasTradableCharacter && (
          <button
            className="find-flip-btn"
            type="button"
            onClick={onFindMeAFlip}
          >
            <svg
              fill="none"
              height="16"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
              width="16"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            Find Me a Flip
          </button>
        )}
      </div>

      {/* Row 2: Filters (Desktop) */}
      <div className="controls-row controls-filters">
        <FiltersDropdown
          activePresets={activePresets}
          filters={filters}
          hideNegativeMargin={hideNegativeMargin}
          hideNegativeRoi={hideNegativeRoi}
          membersFilter={membersFilter}
          minFlipQuality={minFlipQuality}
          savedPresets={savedPresets}
          onFilterChange={onFilterChange}
          onMembersFilterChange={onMembersFilterChange}
          onTogglePreset={onTogglePreset}
          onToggleNegative={onToggleNegative}
          onMinFlipQualityChange={onMinFlipQualityChange}
          onSavePreset={onSavePreset}
          onResetAll={onResetFilters}
          onApply={onApplyFilters}
        />

        <button className="reset-btn" type="button" onClick={onResetFilters}>
          <svg
            fill="none"
            height="14"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
            width="14"
          >
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
          Reset
        </button>
      </div>

      {/* Row 3: Mobile controls */}
      <div className="controls-row controls-mobile">
        <div className="mobile-sort">
          <label className="filter-label" htmlFor="mobile-sort">
            Sort by
          </label>
          <select
            className="filter-select"
            id="mobile-sort"
            value={sortValue}
            onChange={(e) => onSortChange(e.target.value)}
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <button className="refine-toggle" type="button" onClick={onOpenRefine}>
          Filters &amp; details
        </button>
      </div>

      {/* Smart Filter Banner */}
      {smartFilterBankroll !== null && (
        <div className="smart-filter-banner">
          <span>
            Showing flips for your{' '}
            <strong>{formatGp(smartFilterBankroll)}</strong> bankroll
          </span>
          <button
            className="smart-filter-banner__clear"
            type="button"
            onClick={onClearSmartFilter}
          >
            Clear
          </button>
        </div>
      )}

      {/* Row 4: Status + Bankroll tag */}
      <div className="controls-row controls-status">
        <div className="live-indicator">
          <span className="live-dot" />
          <span className="live-label">Live</span>
          <span className="live-time">
            {now
              ? new Date(now).toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true,
                })
              : '—'}
          </span>

          {/* Bankroll tag (signed-in + tradable character only) */}
          {isSignedIn && hasTradableCharacter && currentBankroll !== null && currentBankroll > 0 && (
            <a
              className="bankroll-tag"
              href="/trading/tracker"
              title="Manage your bankroll in the Trade Tracker"
            >
              💰 {formatGp(currentBankroll)}
            </a>
          )}
          {isSignedIn && hasTradableCharacter &&
            (currentBankroll === null || currentBankroll === 0) && (
              <button
                className="bankroll-tag bankroll-tag--empty"
                type="button"
                onClick={onOpenBankrollSetup}
                title="Set your trading bankroll"
              >
                Set Bankroll
              </button>
            )}
        </div>

        <div className="refresh-controls">
          <div className="refresh-interval">
            <label htmlFor={refreshId}>Refresh</label>
            <select
              id={refreshId}
              value={refreshInterval}
              onChange={(e) => onRefreshIntervalChange(Number(e.target.value))}
            >
              {REFRESH_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <button
            aria-label={isRefreshPaused ? 'Resume' : 'Pause'}
            className={`pause-btn ${isRefreshPaused ? 'paused' : ''}`}
            type="button"
            onClick={onToggleRefreshPaused}
          >
            {isRefreshPaused ? (
              <svg
                fill="currentColor"
                height="14"
                viewBox="0 0 24 24"
                width="14"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            ) : (
              <svg
                fill="currentColor"
                height="14"
                viewBox="0 0 24 24"
                width="14"
              >
                <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
              </svg>
            )}
            {isRefreshPaused ? 'Resume' : 'Pause'}
          </button>
        </div>

        <div className="update-status">
          <span className="next-update">
            Next update in <strong>{nextRefreshLabel}</strong>
          </span>
          <span className="last-update">
            Last updated <strong>{lastUpdatedLabel}</strong>
          </span>
        </div>
      </div>

      {/* Refine Panel (Mobile) */}
      {isRefineOpen && (
        <>
          <button
            aria-label="Close filters"
            className="exchange-refine-backdrop"
            type="button"
            onClick={onCloseRefine}
          />
          <div
            aria-modal="true"
            className="exchange-refine-panel"
            role="dialog"
          >
            <div className="refine-header">
              <div>
                <h3>Refine Exchange</h3>
                <p>Adjust filters and presets for the GE list.</p>
              </div>
              <button
                aria-label="Close filters"
                className="refine-close"
                type="button"
                onClick={onCloseRefine}
              >
                ✕
              </button>
            </div>

            <div className="refine-section">
              <label className="filter-label" htmlFor="refine-sort">
                Sort
              </label>
              <select
                className="filter-select"
                id="refine-sort"
                value={sortValue}
                onChange={(e) => onSortChange(e.target.value)}
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="refine-section refine-grid">
              {(
                [
                  ['buyPrice', 'Buy Price'],
                  ['sellPrice', 'Sell Price'],
                  ['margin', 'Margin'],
                  ['profit', 'Profit'],
                  ['roi', 'ROI %'],
                  ['volume', 'Volume'],
                  ['potentialProfit', 'Potential Profit'],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="refine-field">
                  <span className="filter-label">{label}</span>
                  <div className="range-inputs">
                    <input
                      placeholder="Min"
                      type="text"
                      value={filters[key].min}
                      onChange={(e) =>
                        onFilterChange(key, 'min', e.target.value)
                      }
                    />
                    <input
                      placeholder="Max"
                      type="text"
                      value={filters[key].max}
                      onChange={(e) =>
                        onFilterChange(key, 'max', e.target.value)
                      }
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="refine-section refine-row">
              <div className="filter-group">
                <label className="filter-label" htmlFor="refine-items">
                  Items
                </label>
                <select
                  className="filter-select"
                  id="refine-items"
                  value={membersFilter}
                  onChange={(e) =>
                    onMembersFilterChange(e.target.value as MembersFilter)
                  }
                >
                  <option value="all">All Items</option>
                  <option value="members">Members</option>
                  <option value="f2p">F2P</option>
                </select>
              </div>
            </div>

            <div className="refine-section refine-row">
              <label
                className={`toggle-chip ${hideNegativeMargin ? 'active' : ''}`}
              >
                <input
                  checked={hideNegativeMargin}
                  type="checkbox"
                  onChange={() => onToggleNegative('margin')}
                />
                <span>Hide -Margin</span>
              </label>

              <label
                className={`toggle-chip ${hideNegativeRoi ? 'active' : ''}`}
              >
                <input
                  checked={hideNegativeRoi}
                  type="checkbox"
                  onChange={() => onToggleNegative('roi')}
                />
                <span>Hide -ROI</span>
              </label>
            </div>

            <div className="refine-actions">
              <button
                className="button"
                type="button"
                onClick={() => {
                  onApplyFilters();
                  onCloseRefine();
                }}
              >
                Apply filters
              </button>
              <button
                className="button ghost"
                type="button"
                onClick={() => {
                  onResetFilters();
                  onCloseRefine();
                }}
              >
                Reset all
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
