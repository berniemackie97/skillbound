'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';

import { formatGp, getItemIconUrl } from '@/lib/trading/ge-service';

export interface ItemSearchResult {
  id: number;
  name: string;
  icon: string;
  members: boolean;
  buyLimit: number | null;
  buyPrice: number | null;
  sellPrice: number | null;
}

interface SearchApiResponse {
  data?: ItemSearchResult[];
}

interface ItemSearchProps {
  onSelect: (item: ItemSearchResult) => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  initialValue?: string;
  showPrices?: boolean;
  inputId?: string;
}

export function ItemSearch({
  onSelect,
  placeholder = 'Jump to item',
  autoFocus = false,
  className = '',
  initialValue = '',
  showPrices = false,
  inputId,
}: ItemSearchProps) {
  const [query, setQuery] = useState(initialValue);
  const [results, setResults] = useState<ItemSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Search for items
  const searchItems = useCallback(async (searchQuery: string) => {
    if (!searchQuery || searchQuery.length < 1) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/ge/search?q=${encodeURIComponent(searchQuery)}&limit=10`
      );
      if (response.ok) {
        const data = (await response.json()) as SearchApiResponse;
        setResults(data.data ?? []);
        setIsOpen((data.data?.length ?? 0) > 0);
        setSelectedIndex(-1);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Debounced search
  const handleQueryChange = useCallback(
    (value: string) => {
      setQuery(value);
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        void searchItems(value);
      }, 150);
    },
    [searchItems]
  );

  // Handle item selection
  const handleSelect = useCallback(
    (item: ItemSearchResult) => {
      onSelect(item);
      setQuery('');
      setResults([]);
      setIsOpen(false);
      inputRef.current?.blur();
    },
    [onSelect]
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < results.length - 1 ? prev + 1 : prev
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedIndex >= 0 && results[selectedIndex]) {
            handleSelect(results[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          inputRef.current?.blur();
          break;
      }
    },
    [isOpen, results, selectedIndex, handleSelect]
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus();
    }
  }, [autoFocus]);

  return (
    <div ref={containerRef} className={`item-search ${className}`}>
      <div className="search-input-wrapper">
        <svg
          className="search-icon"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          ref={inputRef}
          className="search-input"
          id={inputId}
          placeholder={placeholder}
          type="text"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onFocus={() => query && results.length > 0 && setIsOpen(true)}
          onKeyDown={handleKeyDown}
        />
        {query && (
          <button
            aria-label="Clear search"
            className="clear-button"
            type="button"
            onClick={() => {
              setQuery('');
              setResults([]);
              setIsOpen(false);
              inputRef.current?.focus();
            }}
          >
            <svg fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z" />
            </svg>
          </button>
        )}
        {isLoading && <span className="loading-spinner" />}
      </div>

      {isOpen && results.length > 0 && (
        <ul className="search-results" role="listbox">
          {results.map((item, index) => (
            <li key={item.id}>
              <button
                className={`search-result ${index === selectedIndex ? 'selected' : ''}`}
                type="button"
                onClick={() => handleSelect(item)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <Image
                  alt=""
                  className="item-icon"
                  height={32}
                  loading="lazy"
                  src={getItemIconUrl(item.icon)}
                  width={32}
                />
                <div className="item-info">
                  <span className="item-name">{item.name}</span>
                  {showPrices && (
                    <span className="item-prices">
                      {item.buyPrice !== null && (
                        <span className="buy-price">
                          Buy: {formatGp(item.buyPrice)}
                        </span>
                      )}
                      {item.sellPrice !== null && (
                        <span className="sell-price">
                          Sell: {formatGp(item.sellPrice)}
                        </span>
                      )}
                    </span>
                  )}
                </div>
                {item.members && <span className="members-badge">P2P</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
