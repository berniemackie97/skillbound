'use client';

import { useCallback, useEffect, useRef } from 'react';

import type { ColumnFilterKey } from './exchange-table';

interface MobileFilterSheetProps {
  isOpen: boolean;
  filterKey: ColumnFilterKey;
  label: string;
  minValue: string;
  maxValue: string;
  onMinChange: (value: string) => void;
  onMaxChange: (value: string) => void;
  onApply: () => void;
  onClear: () => void;
  onClose: () => void;
}

export function MobileFilterSheet({
  isOpen,
  filterKey,
  label,
  minValue,
  maxValue,
  onMinChange,
  onMaxChange,
  onApply,
  onClear,
  onClose,
}: MobileFilterSheetProps) {
  const minInputRef = useRef<HTMLInputElement>(null);

  // Focus min input when sheet opens
  useEffect(() => {
    if (isOpen && minInputRef.current) {
      // Small delay to let animation start
      setTimeout(() => minInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  const handleApply = useCallback(() => {
    onApply();
    onClose();
  }, [onApply, onClose]);

  const handleClear = useCallback(() => {
    onClear();
    onClose();
  }, [onClear, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        className="mobile-filter-backdrop"
        onClick={onClose}
      />

      {/* Filter Sheet */}
      <div className="mobile-filter-sheet">
        <div className="mobile-filter-header">
          <h3 className="mobile-filter-title">Filter {label}</h3>
          <button
            aria-label="Close filter"
            className="mobile-filter-close"
            type="button"
            onClick={onClose}
          >
            <svg
              fill="none"
              height="24"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
              width="24"
            >
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mobile-filter-body">
          <div className="mobile-filter-field">
            <label htmlFor={`filter-min-${filterKey}`}>Minimum</label>
            <input
              ref={minInputRef}
              id={`filter-min-${filterKey}`}
              inputMode="numeric"
              placeholder="No minimum"
              type="text"
              value={minValue}
              onChange={(e) => onMinChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleApply();
              }}
            />
          </div>

          <div className="mobile-filter-field">
            <label htmlFor={`filter-max-${filterKey}`}>Maximum</label>
            <input
              id={`filter-max-${filterKey}`}
              inputMode="numeric"
              placeholder="No maximum"
              type="text"
              value={maxValue}
              onChange={(e) => onMaxChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleApply();
              }}
            />
          </div>
        </div>

        <div className="mobile-filter-actions">
          <button
            className="mobile-filter-btn secondary"
            type="button"
            onClick={handleClear}
          >
            Clear Filter
          </button>
          <button
            className="mobile-filter-btn primary"
            type="button"
            onClick={handleApply}
          >
            Apply Filter
          </button>
        </div>
      </div>
    </>
  );
}
