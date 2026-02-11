'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { FlipQualityGrade } from '@/lib/trading/flip-scoring';

import type {
  ColumnFilterKey,
  ColumnFilterState,
  SavedPreset,
} from './exchange-client.types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BuiltInPresetId =
  | 'high-margin'
  | 'high-roi'
  | 'high-volume'
  | 'high-profit'
  | 'high-potential'
  | 'low-price'
  | 'high-price';

export type MembersFilter = 'all' | 'members' | 'f2p';

export interface FiltersDropdownProps {
  // Active state
  activePresets: Set<string>;
  hideNegativeMargin: boolean;
  hideNegativeRoi: boolean;
  minFlipQuality: FlipQualityGrade | null;

  // Members filter (moved inside from controls row)
  membersFilter: MembersFilter;
  onMembersFilterChange: (value: MembersFilter) => void;

  // Column range filters
  filters: ColumnFilterState;
  onFilterChange: (
    key: ColumnFilterKey,
    field: 'min' | 'max',
    value: string
  ) => void;

  // Saved user presets
  savedPresets: SavedPreset[];

  // Callbacks
  onTogglePreset: (presetId: string) => void;
  onToggleNegative: (type: 'margin' | 'roi') => void;
  onMinFlipQualityChange: (grade: FlipQualityGrade | null) => void;
  onSavePreset: () => void;
  onResetAll: () => void;
  onApply: () => void;
}

// ---------------------------------------------------------------------------
// Built-in presets with descriptions
// ---------------------------------------------------------------------------

const BUILT_IN_PRESETS: Array<{
  id: BuiltInPresetId;
  label: string;
  description: string;
}> = [
  { id: 'high-margin', label: 'High Margin', description: '≥100k margin' },
  { id: 'high-roi', label: 'High ROI', description: '≥5% ROI' },
  { id: 'high-volume', label: 'High Volume', description: '≥500 trades/hr' },
  { id: 'high-profit', label: 'High Profit', description: '≥100k profit' },
  {
    id: 'high-potential',
    label: 'High Potential',
    description: '≥1m pot. profit',
  },
  { id: 'low-price', label: 'Low Price', description: '≤50k buy price' },
  { id: 'high-price', label: 'High Price', description: '≥1m buy price' },
];

const QUALITY_GRADES: Array<{ value: FlipQualityGrade; label: string }> = [
  { value: 'A', label: 'A+ (Excellent)' },
  { value: 'B', label: 'B+ (Good)' },
  { value: 'C', label: 'C+ (Average)' },
  { value: 'D', label: 'D+ (Risky)' },
];

const RANGE_FILTER_FIELDS: Array<{
  key: ColumnFilterKey;
  label: string;
  placeholder?: [string, string];
}> = [
  { key: 'buyPrice', label: 'Buy Price' },
  { key: 'sellPrice', label: 'Sell Price' },
  { key: 'margin', label: 'Margin' },
  { key: 'profit', label: 'Profit' },
  { key: 'roi', label: 'ROI %' },
  { key: 'volume', label: 'Volume' },
  { key: 'potentialProfit', label: 'Pot. Profit' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FiltersDropdown({
  activePresets,
  hideNegativeMargin,
  hideNegativeRoi,
  minFlipQuality,
  membersFilter,
  onMembersFilterChange,
  filters,
  onFilterChange,
  savedPresets,
  onTogglePreset,
  onToggleNegative,
  onMinFlipQualityChange,
  onSavePreset,
  onResetAll,
  onApply,
}: FiltersDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Count active filters
  const rangeCount = RANGE_FILTER_FIELDS.reduce((count, { key }) => {
    const f = filters[key];
    return count + (f.min || f.max ? 1 : 0);
  }, 0);

  const activeCount =
    activePresets.size +
    (hideNegativeMargin ? 1 : 0) +
    (hideNegativeRoi ? 1 : 0) +
    (minFlipQuality ? 1 : 0) +
    rangeCount;

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleApply = useCallback(() => {
    onApply();
    setIsOpen(false);
  }, [onApply]);

  const handleReset = useCallback(() => {
    onResetAll();
    setIsOpen(false);
  }, [onResetAll]);

  return (
    <div className="filters-dropdown" ref={dropdownRef}>
      <button
        className={`filters-dropdown__trigger ${activeCount > 0 ? 'filters-dropdown__trigger--active' : ''}`}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
      >
        <svg
          fill="none"
          height="14"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
          width="14"
        >
          <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
        </svg>
        Filters
        {activeCount > 0 && (
          <span className="filters-dropdown__count">{activeCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="filters-dropdown__panel">
          {/* Items / Members filter */}
          <div className="filters-dropdown__section">
            <h4 className="filters-dropdown__section-title">Items</h4>
            <div className="filters-dropdown__members-row">
              {(['all', 'members', 'f2p'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`filters-dropdown__members-btn ${membersFilter === value ? 'filters-dropdown__members-btn--active' : ''}`}
                  onClick={() => onMembersFilterChange(value)}
                >
                  {value === 'all'
                    ? 'All'
                    : value === 'members'
                      ? 'Members'
                      : 'F2P'}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Filters */}
          <div className="filters-dropdown__section">
            <h4 className="filters-dropdown__section-title">Quick Filters</h4>

            <div className="filters-dropdown__toggles">
              <label className="filters-dropdown__toggle">
                <input
                  type="checkbox"
                  checked={hideNegativeMargin}
                  onChange={() => onToggleNegative('margin')}
                />
                <span>Hide -Margin</span>
              </label>

              <label className="filters-dropdown__toggle">
                <input
                  type="checkbox"
                  checked={hideNegativeRoi}
                  onChange={() => onToggleNegative('roi')}
                />
                <span>Hide -ROI</span>
              </label>
            </div>

            <div className="filters-dropdown__quality-row">
              <span className="filters-dropdown__quality-label">
                Min Quality
              </span>
              <select
                className="filters-dropdown__quality-select"
                value={minFlipQuality ?? ''}
                onChange={(e) =>
                  onMinFlipQualityChange(
                    e.target.value
                      ? (e.target.value as FlipQualityGrade)
                      : null
                  )
                }
              >
                <option value="">Any</option>
                {QUALITY_GRADES.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Range Filters */}
          <div className="filters-dropdown__section">
            <h4 className="filters-dropdown__section-title">Range Filters</h4>
            <div className="filters-dropdown__ranges">
              {RANGE_FILTER_FIELDS.map(({ key, label }) => (
                <div key={key} className="filters-dropdown__range-row">
                  <span className="filters-dropdown__range-label">{label}</span>
                  <div className="filters-dropdown__range-inputs">
                    <input
                      type="text"
                      className="filters-dropdown__range-input"
                      placeholder="Min"
                      value={filters[key].min}
                      onChange={(e) =>
                        onFilterChange(key, 'min', e.target.value)
                      }
                    />
                    <span className="filters-dropdown__range-sep">–</span>
                    <input
                      type="text"
                      className="filters-dropdown__range-input"
                      placeholder="Max"
                      value={filters[key].max}
                      onChange={(e) =>
                        onFilterChange(key, 'max', e.target.value)
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Built-in Presets */}
          <div className="filters-dropdown__section">
            <h4 className="filters-dropdown__section-title">Presets</h4>
            <div className="filters-dropdown__preset-grid">
              {BUILT_IN_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={`filters-dropdown__preset-chip ${activePresets.has(preset.id) ? 'filters-dropdown__preset-chip--active' : ''}`}
                  onClick={() => onTogglePreset(preset.id)}
                  title={preset.description}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* User Saved Presets */}
          {savedPresets.length > 0 && (
            <div className="filters-dropdown__section">
              <h4 className="filters-dropdown__section-title">Saved</h4>
              <div className="filters-dropdown__preset-grid">
                {savedPresets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={`filters-dropdown__preset-chip ${activePresets.has(preset.id) ? 'filters-dropdown__preset-chip--active' : ''}`}
                    onClick={() => onTogglePreset(preset.id)}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="filters-dropdown__actions">
            <button
              className="filters-dropdown__btn filters-dropdown__btn--save"
              type="button"
              onClick={onSavePreset}
            >
              Save Current
            </button>
            <div className="filters-dropdown__actions-right">
              <button
                className="filters-dropdown__btn filters-dropdown__btn--reset"
                type="button"
                onClick={handleReset}
              >
                Reset
              </button>
              <button
                className="filters-dropdown__btn filters-dropdown__btn--apply"
                type="button"
                onClick={handleApply}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
