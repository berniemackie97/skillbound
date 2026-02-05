'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { formatGp, getItemIconUrl } from '@/lib/trading/ge-service';

interface ItemSearchResult {
  id: number;
  name: string;
  icon: string;
  members: boolean;
  buyLimit: number | null;
  buyPrice: number | null;
  sellPrice: number | null;
}

interface ItemSearchResponse {
  data?: ItemSearchResult[];
}

interface ItemDetailResponse {
  data?: ItemSearchResult;
}

interface ValidationError {
  code: string;
  message: string;
  availableQuantity?: number;
  availableBankroll?: number;
}

interface ErrorResponse {
  title?: string;
  detail?: string;
  errors?: ValidationError[];
}

type TradeFormProps = {
  characterId: string;
  onSuccess?: () => void;
  preselectedItemId?: number;
  availableBankroll?: number;
};

export function TradeForm({
  characterId,
  onSuccess,
  preselectedItemId,
  availableBankroll,
}: TradeFormProps) {
  const router = useRouter();

  // Selected item state
  const [selectedItem, setSelectedItem] = useState<ItemSearchResult | null>(
    null
  );
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ItemSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  // Trade details
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
  const [quantity, setQuantity] = useState('');
  const [pricePerItem, setPricePerItem] = useState('');
  const [notes, setNotes] = useState('');

  // Form state
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const totalValue =
    (parseInt(quantity, 10) || 0) * (parseInt(pricePerItem, 10) || 0);
  const exceedsBankroll =
    tradeType === 'buy' &&
    typeof availableBankroll === 'number' &&
    availableBankroll >= 0 &&
    totalValue > availableBankroll;

  // Search for items
  const searchItems = useCallback(async (query: string) => {
    if (!query || query.length < 1) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(
        `/api/ge/search?q=${encodeURIComponent(query)}&limit=8`
      );
      if (response.ok) {
        const data = (await response.json()) as ItemSearchResponse;
        setSearchResults(data.data ?? []);
        setShowDropdown((data.data?.length ?? 0) > 0);
        setSelectedIndex(-1);
      }
    } catch {
      console.error('Item search failed');
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounced search
  const handleSearchChange = useCallback(
    (value: string) => {
      setItemSearchQuery(value);
      if (selectedItem) {
        setSelectedItem(null);
      }
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        void searchItems(value);
      }, 150);
    },
    [searchItems, selectedItem]
  );

  // Handle item selection
  const handleSelectItem = useCallback((item: ItemSearchResult) => {
    setSelectedItem(item);
    setItemSearchQuery(item.name);
    setSearchResults([]);
    setShowDropdown(false);

    // Auto-fill suggested price based on trade type
    if (item.buyPrice !== null || item.sellPrice !== null) {
      // For buying, suggest the instant buy price (high)
      // For selling, suggest the instant sell price (low)
      // But we flip it because user is buying/selling, not the GE
      const suggestedPrice =
        item.sellPrice !== null ? item.sellPrice : item.buyPrice;
      if (suggestedPrice !== null) {
        setPricePerItem(String(suggestedPrice));
      }
    }
  }, []);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!showDropdown) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < searchResults.length - 1 ? prev + 1 : prev
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedIndex >= 0 && searchResults[selectedIndex]) {
            handleSelectItem(searchResults[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setShowDropdown(false);
          break;
      }
    },
    [showDropdown, searchResults, selectedIndex, handleSelectItem]
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load preselected item
  useEffect(() => {
    if (preselectedItemId) {
      fetch(`/api/ge/items/${preselectedItemId}`)
        .then((res) => res.json() as Promise<ItemDetailResponse>)
        .then((data) => {
          if (data.data) {
            handleSelectItem(data.data);
          }
        })
        .catch(() => {});
    }
  }, [preselectedItemId, handleSelectItem]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus(null);
    setIsSubmitting(true);

    if (!selectedItem) {
      setError('Please select an item from the dropdown.');
      setIsSubmitting(false);
      return;
    }

    const parsedQuantity = parseInt(quantity, 10);
    const parsedPrice = parseInt(pricePerItem, 10);

    const MAX_OSRS_INT = 2_147_483_647;

    if (!parsedQuantity || parsedQuantity <= 0) {
      setError('Quantity must be a positive number.');
      setIsSubmitting(false);
      return;
    }

    if (parsedQuantity > MAX_OSRS_INT) {
      setError('Quantity exceeds the maximum allowed (2.147B).');
      setIsSubmitting(false);
      return;
    }

    if (isNaN(parsedPrice) || parsedPrice < 0) {
      setError('Price must be a non-negative number.');
      setIsSubmitting(false);
      return;
    }

    if (parsedPrice > MAX_OSRS_INT) {
      setError('Price exceeds the maximum allowed (2.147B GP).');
      setIsSubmitting(false);
      return;
    }

    if (exceedsBankroll) {
      setError(
        `Not enough bankroll. Available: ${formatGp(availableBankroll ?? 0)} GP.`
      );
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch(`/api/characters/${characterId}/trades`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: selectedItem.id,
          itemName: selectedItem.name,
          tradeType,
          quantity: parsedQuantity,
          pricePerItem: parsedPrice,
          notes: notes.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as ErrorResponse;

        // Handle specific validation errors with user-friendly messages
        const validationError = data.errors?.[0];
        if (validationError) {
          switch (validationError.code) {
            case 'INSUFFICIENT_INVENTORY':
              setError(
                validationError.availableQuantity !== undefined
                  ? `Cannot sell ${parsedQuantity.toLocaleString()} — you only have ${validationError.availableQuantity.toLocaleString()} of this item.`
                  : "You don't have enough of this item to sell."
              );
              break;
            case 'NO_INVENTORY':
              setError(
                `Cannot sell "${selectedItem.name}" — you haven't bought any yet. Record a purchase first.`
              );
              break;
            case 'QUANTITY_TOO_HIGH':
              setError(
                'Quantity exceeds the maximum allowed (2.147B). Please enter a smaller amount.'
              );
              break;
            case 'PRICE_TOO_HIGH':
              setError(
                'Price exceeds the maximum allowed (2.147B GP). Please enter a smaller amount.'
              );
              break;
            case 'INVALID_QUANTITY':
              setError('Please enter a valid quantity greater than 0.');
              break;
            case 'INVALID_PRICE':
              setError('Please enter a valid price (0 or greater).');
              break;
            case 'INSUFFICIENT_BANKROLL':
              setError(
                validationError.availableBankroll !== undefined
                  ? `Not enough bankroll. Available: ${formatGp(validationError.availableBankroll)} GP.`
                  : 'Not enough bankroll for this purchase.'
              );
              break;
            default:
              setError(
                validationError.message || data.detail || 'Validation failed.'
              );
          }
        } else {
          setError(data.detail ?? 'Failed to create trade.');
        }
        setIsSubmitting(false);
        return;
      }

      setStatus('Trade recorded successfully!');
      setSelectedItem(null);
      setItemSearchQuery('');
      setQuantity('');
      setPricePerItem('');
      setNotes('');

      router.refresh();
      onSuccess?.();
    } catch {
      setError('Failed to create trade. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="trade-form" onSubmit={handleSubmit}>
      <div className="trade-type-toggle">
        <button
          className={`toggle-btn ${tradeType === 'buy' ? 'active' : ''}`}
          type="button"
          onClick={() => setTradeType('buy')}
        >
          Buy
        </button>
        <button
          className={`toggle-btn ${tradeType === 'sell' ? 'active sell' : ''}`}
          type="button"
          onClick={() => setTradeType('sell')}
        >
          Sell
        </button>
      </div>

      {/* Item search with autocomplete */}
      <div className="form-field item-search-field">
        <label htmlFor="item-search">Item</label>
        <div className="item-search-wrapper">
          <div className="search-input-container">
            {selectedItem && (
              <img
                alt=""
                className="selected-item-icon"
                height={24}
                src={getItemIconUrl(selectedItem.icon)}
                width={24}
              />
            )}
            <input
              ref={searchInputRef}
              autoComplete="off"
              className={selectedItem ? 'has-selection' : ''}
              id="item-search"
              placeholder="Search for an item..."
              type="text"
              value={itemSearchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() =>
                itemSearchQuery &&
                searchResults.length > 0 &&
                setShowDropdown(true)
              }
            />
            {isSearching && <span className="search-spinner" />}
            {selectedItem && (
              <button
                aria-label="Clear selection"
                className="clear-selection"
                type="button"
                onClick={() => {
                  setSelectedItem(null);
                  setItemSearchQuery('');
                  setPricePerItem('');
                  searchInputRef.current?.focus();
                }}
              >
                ×
              </button>
            )}
          </div>

          {showDropdown && searchResults.length > 0 && (
            <div ref={dropdownRef} className="item-search-dropdown">
              {searchResults.map((item, index) => (
                <button
                  key={item.id}
                  className={`dropdown-item ${index === selectedIndex ? 'selected' : ''}`}
                  type="button"
                  onClick={() => handleSelectItem(item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <img
                    alt=""
                    className="item-icon"
                    height={32}
                    loading="lazy"
                    src={getItemIconUrl(item.icon)}
                    width={32}
                  />
                  <div className="item-details">
                    <span className="item-name">{item.name}</span>
                    <span className="item-prices">
                      {item.buyPrice !== null && (
                        <span className="price buy">
                          Buy: {formatGp(item.buyPrice)}
                        </span>
                      )}
                      {item.sellPrice !== null && (
                        <span className="price sell">
                          Sell: {formatGp(item.sellPrice)}
                        </span>
                      )}
                    </span>
                  </div>
                  {item.members && <span className="members-badge">P2P</span>}
                </button>
              ))}
            </div>
          )}
        </div>
        {selectedItem && (
          <div className="selected-item-info">
            <span className="item-id">ID: {selectedItem.id}</span>
            {selectedItem.buyLimit && (
              <span className="buy-limit">
                Limit: {selectedItem.buyLimit.toLocaleString()}/4hrs
              </span>
            )}
          </div>
        )}
      </div>

      <div className="form-row">
        <label className="form-field">
          <span>Quantity</span>
          <input
            required
            min="1"
            placeholder="1"
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </label>
        <label className="form-field">
          <span>Price per item (GP)</span>
          <input
            required
            min="0"
            placeholder="0"
            type="number"
            value={pricePerItem}
            onChange={(e) => setPricePerItem(e.target.value)}
          />
        </label>
      </div>

      <div className="total-value">
        <span>Total Value:</span>
        <strong className={tradeType === 'buy' ? 'cost' : 'revenue'}>
          {formatGp(totalValue)} GP
        </strong>
        {tradeType === 'buy' && typeof availableBankroll === 'number' && (
          <span className="bankroll-available">
            Available: {formatGp(availableBankroll)} GP
          </span>
        )}
      </div>

      <label className="form-field">
        <span>Notes (optional)</span>
        <input
          placeholder="Any notes about this trade..."
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>

      <button
        className={`button submit-btn ${tradeType}`}
        disabled={isSubmitting || !selectedItem || exceedsBankroll}
        type="submit"
      >
        {isSubmitting
          ? 'Recording...'
          : `Record ${tradeType === 'buy' ? 'Purchase' : 'Sale'}`}
      </button>

      {status && <div className="status-note success">{status}</div>}
      {error && <div className="error">{error}</div>}
    </form>
  );
}
