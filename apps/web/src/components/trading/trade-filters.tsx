'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { TimePeriod } from '@/lib/trading/trading-service';

export type TradeFilterCharacter = {
  id: string;
  displayName: string;
};

type TradeFiltersProps = {
  characters: TradeFilterCharacter[];
  activeCharacterId: string | null;
  activeCharacterName: string | null;
  scope: 'character' | 'all';
  selectedCharacterId: string | null;
  tradeType: 'buy' | 'sell' | 'all';
  search: string;
  period: TimePeriod;
};

function buildUrl(
  searchParams: URLSearchParams,
  updates: Record<string, string | null>
): string {
  const params = new URLSearchParams(searchParams.toString());
  Object.entries(updates).forEach(([key, value]) => {
    if (value === null || value === '') {
      params.delete(key);
    } else {
      params.set(key, value);
    }
  });
  return `/trading?${params.toString()}`;
}

export function TradeFilters({
  characters,
  activeCharacterId,
  activeCharacterName,
  scope,
  selectedCharacterId,
  tradeType,
  search,
  period,
}: TradeFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [searchValue, setSearchValue] = useState(search);
  const [tradeTypeValue, setTradeTypeValue] = useState(tradeType);
  const [scopeValue, setScopeValue] = useState(scope);
  const [characterValue, setCharacterValue] = useState(
    selectedCharacterId ?? ''
  );

  useEffect(() => {
    setSearchValue(search);
    setTradeTypeValue(tradeType);
    setScopeValue(scope);
    setCharacterValue(selectedCharacterId ?? '');
  }, [search, tradeType, scope, selectedCharacterId]);

  const characterOptions = useMemo(() => {
    const options = characters.map((character) => ({
      id: character.id,
      label: character.displayName,
    }));
    return options;
  }, [characters]);

  const applyFilters = useCallback(
    (updates: Record<string, string | null>) => {
      router.push(buildUrl(searchParams, { tab: 'tracker', ...updates }));
    },
    [router, searchParams]
  );

  const handleSearchSubmit = useCallback(() => {
    applyFilters({
      page: '1',
      search: searchValue.trim() || null,
    });
  }, [applyFilters, searchValue]);

  const handleScopeChange = useCallback(
    (nextScope: 'character' | 'all') => {
      setScopeValue(nextScope);
      applyFilters({
        page: '1',
        scope: nextScope === 'all' ? 'all' : null,
        characterId:
          nextScope === 'all' ? null : characterValue || activeCharacterId,
      });
    },
    [applyFilters, characterValue, activeCharacterId]
  );

  const handleCharacterChange = useCallback(
    (nextCharacterId: string) => {
      setCharacterValue(nextCharacterId);
      applyFilters({
        page: '1',
        scope: nextCharacterId
          ? 'character'
          : scopeValue === 'all'
            ? 'all'
            : null,
        characterId: nextCharacterId || null,
      });
    },
    [applyFilters, scopeValue]
  );

  const handleTradeTypeChange = useCallback(
    (nextType: 'buy' | 'sell' | 'all') => {
      setTradeTypeValue(nextType);
      applyFilters({
        page: '1',
        tradeType: nextType === 'all' ? null : nextType,
      });
    },
    [applyFilters]
  );

  const handlePeriodChange = useCallback(
    (nextPeriod: TimePeriod) => {
      applyFilters({
        page: '1',
        period: nextPeriod,
      });
    },
    [applyFilters]
  );

  const handleReset = useCallback(() => {
    setSearchValue('');
    setTradeTypeValue('all');
    setScopeValue('character');
    setCharacterValue(activeCharacterId ?? '');
    applyFilters({
      page: '1',
      scope: null,
      characterId: activeCharacterId ?? null,
      tradeType: null,
      search: null,
      period: 'all',
    });
  }, [applyFilters, activeCharacterId]);

  return (
    <div className="trade-filters">
      {/* Top filter bar */}
      <div className="filter-bar">
        <div className="filter-search-wrapper">
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
            className="filter-search-input"
            placeholder="Search trades..."
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearchSubmit()}
          />
        </div>

        <div className="filter-controls">
          <div className="filter-segment">
            <button
              className={`segment-btn ${scopeValue === 'character' ? 'active' : ''}`}
              type="button"
              onClick={() => handleScopeChange('character')}
            >
              Character
            </button>
            <button
              className={`segment-btn ${scopeValue === 'all' ? 'active' : ''}`}
              type="button"
              onClick={() => handleScopeChange('all')}
            >
              All
            </button>
          </div>

          <select
            className="filter-select"
            value={characterValue}
            onChange={(e) => handleCharacterChange(e.target.value)}
          >
            <option value="">
              {activeCharacterName ? `${activeCharacterName}` : 'Character'}
            </option>
            {characterOptions.map((character) => (
              <option key={character.id} value={character.id}>
                {character.label}
              </option>
            ))}
          </select>

          <select
            className="filter-select compact"
            value={tradeTypeValue}
            onChange={(e) =>
              handleTradeTypeChange(e.target.value as 'buy' | 'sell' | 'all')
            }
          >
            <option value="all">All Types</option>
            <option value="buy">Buys</option>
            <option value="sell">Sells</option>
          </select>
        </div>
      </div>

      {/* Period selector */}
      <div className="filter-period">
        <div className="period-tabs">
          {(['today', 'week', 'month', 'year', 'all'] as TimePeriod[]).map(
            (value) => (
              <button
                key={value}
                className={`period-tab ${period === value ? 'active' : ''}`}
                type="button"
                onClick={() => handlePeriodChange(value)}
              >
                {value === 'today'
                  ? 'Today'
                  : value === 'week'
                    ? 'Week'
                    : value === 'month'
                      ? 'Month'
                      : value === 'year'
                        ? 'Year'
                        : 'All Time'}
              </button>
            )
          )}
        </div>

        <button
          className="reset-filters-btn"
          type="button"
          onClick={handleReset}
        >
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
    </div>
  );
}
