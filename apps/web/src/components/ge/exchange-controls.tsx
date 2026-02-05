import { REFRESH_OPTIONS } from './exchange-client.constants';
import type {
  ColumnFilterKey,
  ColumnFilterState,
  MembersFilter,
  SavedPreset,
  ViewMode,
} from './exchange-client.types';
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
  presetValue: string;
  savedPresets: SavedPreset[];
  onPresetSelect: (value: string) => void;
  onSavePreset: () => void;
  stackPresets: boolean;
  onToggleStackPresets: () => void;
  hideNegativeMargin: boolean;
  hideNegativeRoi: boolean;
  onToggleNegative: (type: 'margin' | 'roi') => void;
  onResetFilters: () => void;
  refreshInterval: number;
  onRefreshIntervalChange: (value: number) => void;
  isRefreshPaused: boolean;
  onToggleRefreshPaused: () => void;
  nextRefreshLabel: string;
  lastUpdatedLabel: string;
  now: number | null;
  isRefineOpen: boolean;
  onOpenRefine: () => void;
  onCloseRefine: () => void;
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
  presetValue,
  savedPresets,
  onPresetSelect,
  onSavePreset,
  stackPresets,
  onToggleStackPresets,
  hideNegativeMargin,
  hideNegativeRoi,
  onToggleNegative,
  onResetFilters,
  refreshInterval,
  onRefreshIntervalChange,
  isRefreshPaused,
  onToggleRefreshPaused,
  nextRefreshLabel,
  lastUpdatedLabel,
  now,
  isRefineOpen,
  onOpenRefine,
  onCloseRefine,
}: ExchangeControlsProps) {
  return (
    <div className="exchange-controls">
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
      </div>

      <div className="controls-row controls-filters">
        <div className="filter-group">
          <label className="filter-label">Items</label>
          <select
            className="filter-select"
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

        <div className="filter-group">
          <label className="filter-label">Preset</label>
          <select
            className="filter-select"
            value={presetValue}
            onChange={(e) => onPresetSelect(e.target.value)}
          >
            <option value="custom">Custom</option>
            <option value="high-margin">High Margin</option>
            <option value="high-roi">High ROI</option>
            <option value="high-volume">High Volume</option>
            <option value="high-profit">High Profit</option>
            <option value="high-potential">High Potential</option>
            <option value="low-price">Low Price</option>
            <option value="high-price">High Price</option>
            {savedPresets.length > 0 && (
              <option disabled value="">
                ───
              </option>
            )}
            {savedPresets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </select>
        </div>

        <button
          className="save-preset-btn"
          type="button"
          onClick={onSavePreset}
        >
          <svg
            fill="none"
            height="14"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
            width="14"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          Save Preset
        </button>

        <div className="filter-toggles">
          <label className={`toggle-chip ${stackPresets ? 'active' : ''}`}>
            <input
              checked={stackPresets}
              type="checkbox"
              onChange={onToggleStackPresets}
            />
            <span>Stack Presets</span>
          </label>
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
          <label className={`toggle-chip ${hideNegativeRoi ? 'active' : ''}`}>
            <input
              checked={hideNegativeRoi}
              type="checkbox"
              onChange={() => onToggleNegative('roi')}
            />
            <span>Hide -ROI</span>
          </label>
        </div>

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
        </div>

        <div className="refresh-controls">
          <div className="refresh-interval">
            <label>Refresh</label>
            <select
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

      {isRefineOpen && (
        <>
          <div className="exchange-refine-backdrop" onClick={onCloseRefine} />
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
                <label className="filter-label">Items</label>
                <select
                  className="filter-select"
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

              <div className="filter-group">
                <label className="filter-label">Preset</label>
                <select
                  className="filter-select"
                  value={presetValue}
                  onChange={(e) => onPresetSelect(e.target.value)}
                >
                  <option value="custom">Custom</option>
                  <option value="high-margin">High Margin</option>
                  <option value="high-roi">High ROI</option>
                  <option value="high-volume">High Volume</option>
                  <option value="high-profit">High Profit</option>
                  <option value="high-potential">High Potential</option>
                  <option value="low-price">Low Price</option>
                  <option value="high-price">High Price</option>
                  {savedPresets.length > 0 && (
                    <option disabled value="">
                      ───
                    </option>
                  )}
                  {savedPresets.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="refine-section refine-row">
              <button
                className="save-preset-btn"
                type="button"
                onClick={onSavePreset}
              >
                <svg
                  fill="none"
                  height="14"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  width="14"
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Save Preset
              </button>

              <label className={`toggle-chip ${stackPresets ? 'active' : ''}`}>
                <input
                  checked={stackPresets}
                  type="checkbox"
                  onChange={onToggleStackPresets}
                />
                <span>Stack Presets</span>
              </label>

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
