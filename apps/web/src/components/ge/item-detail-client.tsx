'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

interface ItemDetailClientProps {
  itemId: number;
  initialFavorite?: boolean;
}

const FAVORITES_STORAGE_KEY = 'skillbound:ge-favorites';

export function ItemDetailClient({
  itemId,
  initialFavorite = false,
}: ItemDetailClientProps) {
  const [isFavorite, setIsFavorite] = useState(initialFavorite);

  // Load favorites from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(FAVORITES_STORAGE_KEY);
      if (stored) {
        const favorites = JSON.parse(stored) as number[];
        setIsFavorite(favorites.includes(itemId));
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [itemId]);

  const toggleFavorite = useCallback(() => {
    try {
      const stored = localStorage.getItem(FAVORITES_STORAGE_KEY);
      const favorites: number[] = stored ? (JSON.parse(stored) as number[]) : [];

      if (favorites.includes(itemId)) {
        const updated = favorites.filter((id) => id !== itemId);
        localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(updated));
        setIsFavorite(false);
      } else {
        favorites.push(itemId);
        localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
        setIsFavorite(true);
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [itemId]);

  return (
    <div className="item-actions">
      <button
        aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        className={`favorite-btn large ${isFavorite ? 'active' : ''}`}
        type="button"
        onClick={toggleFavorite}
      >
        <svg height="20" viewBox="0 0 24 24" width="20">
          <path
            d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
            fill={isFavorite ? '#ffd700' : 'none'}
            stroke={isFavorite ? '#ffd700' : 'currentColor'}
            strokeWidth="2"
          />
        </svg>
      </button>
      <Link
        className="action-btn add-to-list"
        href={`/trading?addTrade=${itemId}`}
      >
        + Add to List
      </Link>
    </div>
  );
}
