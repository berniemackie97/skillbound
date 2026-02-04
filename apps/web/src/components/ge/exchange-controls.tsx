import { ItemSearch, type ItemSearchResult } from './item-search';
import { REFRESH_OPTIONS } from './exchange-client.constants';
import type {
  MembersFilter,
  SavedPreset,
  ViewMode,
} from './exchange-client.types';

interface ExchangeControlsProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onSearchSelect: (item: ItemSearchResult) => void;
  membersFilter: MembersFilter;
  onMembersFilterChange: (value: MembersFilter) => void;
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
  now: number;
}

export function ExchangeControls({
  viewMode,
  onViewModeChange,
  onSearchSelect,
  membersFilter,
  onMembersFilterChange,
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
}: ExchangeControlsProps) {
  return (
    <div className="exchange-controls">
      <div className="controls-row controls-top">
        <div className="jump-search">
          <ItemSearch
            onSelect={onSearchSelect}
            placeholder="Jump to item..."
            className="main-search"
          />
        </div>

        <div className="view-selector">
          <button
            type="button"
            className={`view-btn ${viewMode === 'catalog' ? 'active' : ''}`}
            onClick={() => onViewModeChange('catalog')}
          >
            Full Catalog
          </button>
          <button
            type="button"
            className={`view-btn ${viewMode === 'favorites' ? 'active' : ''}`}
            onClick={() => onViewModeChange('favorites')}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
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
            onChange={(e) => onMembersFilterChange(e.target.value as MembersFilter)}
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
              <option value="" disabled>
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

        <button type="button" className="save-preset-btn" onClick={onSavePreset}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Save Preset
        </button>

        <div className="filter-toggles">
          <label className={`toggle-chip ${stackPresets ? 'active' : ''}`}>
            <input
              type="checkbox"
              checked={stackPresets}
              onChange={onToggleStackPresets}
            />
            <span>Stack Presets</span>
          </label>
          <label className={`toggle-chip ${hideNegativeMargin ? 'active' : ''}`}>
            <input
              type="checkbox"
              checked={hideNegativeMargin}
              onChange={() => onToggleNegative('margin')}
            />
            <span>Hide -Margin</span>
          </label>
          <label className={`toggle-chip ${hideNegativeRoi ? 'active' : ''}`}>
            <input
              type="checkbox"
              checked={hideNegativeRoi}
              onChange={() => onToggleNegative('roi')}
            />
            <span>Hide -ROI</span>
          </label>
        </div>

        <button type="button" className="reset-btn" onClick={onResetFilters}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
          Reset
        </button>
      </div>

      <div className="controls-row controls-status">
        <div className="live-indicator">
          <span className="live-dot" />
          <span className="live-label">Live</span>
          <span className="live-time">
            {new Date(now).toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            })}
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
            type="button"
            className={`pause-btn ${isRefreshPaused ? 'paused' : ''}`}
            onClick={onToggleRefreshPaused}
            aria-label={isRefreshPaused ? 'Resume' : 'Pause'}
          >
            {isRefreshPaused ? (
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
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
    </div>
  );
}
