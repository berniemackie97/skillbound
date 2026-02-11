'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { FlipQualityGrade } from '@/lib/trading/flip-scoring';

import {
  DEFAULT_FILTERS,
  DEFAULT_REFRESH_INTERVAL,
  FAVORITES_META_STORAGE_KEY,
  FAVORITES_STORAGE_KEY,
  REFRESH_OPTIONS,
} from './exchange-client.constants';
import type {
  ColumnFilterKey,
  ColumnFilterState,
  ExchangeClientProps,
  FlipContext,
  ItemsApiResponse,
  MembersFilter,
  SavedPreset,
  ViewMode,
} from './exchange-client.types';
import {
  areSortsEqual,
  normalizeFilters,
  parseMembersFilter,
  parseParam,
  parseSorts,
} from './exchange-client.utils';
import { ExchangeControls } from './exchange-controls';
import {
  ExchangeTable,
  type SortDirection,
  type SortField,
  type SortState,
} from './exchange-table';
import { ExchangeTopbar } from './exchange-topbar';
import type { ItemSearchResult } from './item-search';

// ---------------------------------------------------------------------------
// Smart filter thresholds (bankroll-based)
// ---------------------------------------------------------------------------

function getSmartFilterThresholds(bankroll: number) {
  let minProfit: number;
  if (bankroll < 1_000_000) {
    minProfit = 1_000;
  } else if (bankroll < 10_000_000) {
    minProfit = 5_000;
  } else if (bankroll < 100_000_000) {
    minProfit = 25_000;
  } else {
    minProfit = 100_000;
  }

  return {
    minProfit: String(minProfit),
    minVolume: '50',
    minRoi: '2',
    maxPrice: String(bankroll),
    minFlipQuality: 'B' as FlipQualityGrade,
  };
}

// ---------------------------------------------------------------------------
// Preset filter definitions
// ---------------------------------------------------------------------------

const PRESET_FILTER_MAP: Record<string, Partial<ColumnFilterState>> = {
  'high-margin': { margin: { min: '100000', max: '' } },
  'high-roi': { roi: { min: '5', max: '' } },
  'high-volume': { volume: { min: '500', max: '' } },
  'high-profit': { profit: { min: '100000', max: '' } },
  'high-potential': { potentialProfit: { min: '1000000', max: '' } },
  'low-price': { buyPrice: { min: '', max: '50000' } },
  'high-price': { buyPrice: { min: '1000000', max: '' } },
};

function mergePresetFilters(
  base: ColumnFilterState,
  activePresets: Set<string>,
  savedPresets: SavedPreset[]
): ColumnFilterState {
  let merged = { ...base };

  for (const presetId of activePresets) {
    // Check built-in presets
    const builtIn = PRESET_FILTER_MAP[presetId];
    if (builtIn) {
      merged = { ...merged, ...builtIn };
      continue;
    }

    // Check saved presets
    const saved = savedPresets.find((p) => p.id === presetId);
    if (saved) {
      // Merge saved preset filters — non-empty values override
      for (const key of Object.keys(saved.filters) as ColumnFilterKey[]) {
        const savedFilter = saved.filters[key];
        if (savedFilter.min || savedFilter.max) {
          merged[key] = { ...savedFilter };
        }
      }
    }
  }

  return merged;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ExchangeClient({
  initialItems,
  initialMeta,
  isSignedIn = false,
}: ExchangeClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [items, setItems] = useState(initialItems);
  const [meta, setMeta] = useState({
    total: initialMeta.total,
    page: initialMeta.page,
    limit: initialMeta.limit,
    totalPages: initialMeta.totalPages,
  });
  const [sorts, setSorts] = useState<SortState[]>(
    parseSorts(initialMeta.sort, initialMeta.order)
  );
  const [isLoading, setIsLoading] = useState(false);
  const [searchFilter, setSearchFilter] = useState(
    searchParams.get('search') ?? ''
  );
  const [membersFilter, setMembersFilter] = useState<MembersFilter>(
    parseMembersFilter(searchParams.get('members'))
  );
  const [filters, setFilters] = useState<ColumnFilterState>({
    buyPrice: {
      min: parseParam(searchParams.get('minPrice')),
      max: parseParam(searchParams.get('maxPrice')),
    },
    sellPrice: {
      min: parseParam(searchParams.get('minSellPrice')),
      max: parseParam(searchParams.get('maxSellPrice')),
    },
    margin: {
      min: parseParam(searchParams.get('minMargin')),
      max: parseParam(searchParams.get('maxMargin')),
    },
    profit: {
      min: parseParam(searchParams.get('minProfit')),
      max: parseParam(searchParams.get('maxProfit')),
    },
    roi: {
      min: parseParam(searchParams.get('minRoi')),
      max: parseParam(searchParams.get('maxRoi')),
    },
    volume: {
      min: parseParam(searchParams.get('minVolume')),
      max: parseParam(searchParams.get('maxVolume')),
    },
    potentialProfit: {
      min: parseParam(searchParams.get('minPotentialProfit')),
      max: parseParam(searchParams.get('maxPotentialProfit')),
    },
  });
  const [hideNegativeMargin, setHideNegativeMargin] = useState(false);
  const [hideNegativeRoi, setHideNegativeRoi] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(
    (searchParams.get('view') as ViewMode) ?? 'catalog'
  );
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const [savedPresets, setSavedPresets] = useState<SavedPreset[]>([]);

  // Multi-preset state (replaces old presetValue + stackPresets)
  const [activePresets, setActivePresets] = useState<Set<string>>(new Set());

  // Flip quality filter
  const [minFlipQuality, setMinFlipQuality] =
    useState<FlipQualityGrade | null>(null);

  // Flip context (bankroll, trade history, inventory)
  const [flipContext, setFlipContext] = useState<FlipContext | null>(null);


  // Smart filter banner
  const [smartFilterBankroll, setSmartFilterBankroll] = useState<number | null>(
    null
  );

  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [nextRefreshAt, setNextRefreshAt] = useState<number | null>(null);
  const [refreshInterval, setRefreshInterval] = useState<number>(
    DEFAULT_REFRESH_INTERVAL
  );
  const [isRefreshPaused, setIsRefreshPaused] = useState(false);
  const [isRefineOpen, setIsRefineOpen] = useState(false);
  const sortsRef = useRef(sorts);
  const pageRef = useRef(meta.page);
  const [activeCharacterId, setActiveCharacterId] = useState<string | null>(
    null
  );
  const [watchMap, setWatchMap] = useState<Record<number, string>>({});
  const inFlightRef = useRef(false);

  // -------------------------------------------------------------------------
  // Load favorites from localStorage
  // -------------------------------------------------------------------------

  useEffect(() => {
    try {
      const stored = localStorage.getItem(FAVORITES_STORAGE_KEY);
      if (stored) {
        const favoriteIds = JSON.parse(stored) as number[];
        setFavorites(new Set(favoriteIds));
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // -------------------------------------------------------------------------
  // Load saved presets (signed-in only)
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!isSignedIn) return;
    let active = true;
    const loadPresets = async () => {
      try {
        const response = await fetch('/api/settings/ge-presets');
        if (!response.ok) return;
        const json = (await response.json()) as { data?: SavedPreset[] };
        if (active) {
          setSavedPresets(json.data ?? []);
        }
      } catch {
        // Ignore preset load errors
      }
    };
    void loadPresets();
    return () => {
      active = false;
    };
  }, [isSignedIn]);

  // -------------------------------------------------------------------------
  // Load active character (signed-in only)
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!isSignedIn) return;
    let active = true;
    const loadActiveCharacter = async () => {
      try {
        const response = await fetch('/api/settings/active-character');
        if (!response.ok) return;
        const payload = (await response.json()) as {
          data?: { activeCharacterId?: string | null };
        };
        if (!active) return;
        setActiveCharacterId(payload.data?.activeCharacterId ?? null);
      } catch {
        // Ignore active character errors
      }
    };
    void loadActiveCharacter();
    return () => {
      active = false;
    };
  }, [isSignedIn]);

  // -------------------------------------------------------------------------
  // Load flip context (bankroll + trade history) for signed-in users
  // -------------------------------------------------------------------------

  const refreshFlipContext = useCallback(async () => {
    if (!isSignedIn) return;
    try {
      const response = await fetch('/api/ge/flip-context', {
        cache: 'no-store',
      });
      if (!response.ok) return;
      const payload = (await response.json()) as { data?: FlipContext };
      if (!payload.data) return;
      setFlipContext(payload.data);
      if (payload.data.activeCharacterId) {
        setActiveCharacterId(payload.data.activeCharacterId);
      }
    } catch {
      // Ignore flip context load errors
    }
  }, [isSignedIn]);

  // Fetch flip context on mount
  useEffect(() => {
    void refreshFlipContext();
  }, [refreshFlipContext]);

  // Re-fetch flip context when bankroll changes (from any page/tab via localStorage storage event)
  // AND when user switches back to this tab (visibilitychange)
  useEffect(() => {
    if (!isSignedIn) return;
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key !== 'bankroll-updated') return;
      void refreshFlipContext();
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void refreshFlipContext();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isSignedIn, refreshFlipContext]);

  // -------------------------------------------------------------------------
  // Load watchlist (signed-in + active character)
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!isSignedIn || !activeCharacterId) return;
    let active = true;
    const loadWatchMap = async () => {
      try {
        const response = await fetch(
          `/api/characters/${activeCharacterId}/watchlist?activeOnly=false`
        );
        if (!response.ok) return;
        const payload = (await response.json()) as {
          data?: Array<{ id: string; itemId: number }>;
        };
        if (!active || !payload.data) return;
        const next: Record<number, string> = {};
        payload.data.forEach((item) => {
          next[item.itemId] = item.id;
        });
        setWatchMap(next);
      } catch {
        // Ignore watchlist errors
      }
    };
    void loadWatchMap();
    return () => {
      active = false;
    };
  }, [activeCharacterId, isSignedIn]);

  // -------------------------------------------------------------------------
  // Load refresh settings (signed-in only)
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!isSignedIn) return;
    let active = true;
    const loadRefreshSettings = async () => {
      try {
        const response = await fetch('/api/settings/ge-refresh');
        if (!response.ok) return;
        const payload = (await response.json()) as {
          data?: { intervalMs?: number; paused?: boolean };
        };
        if (!active || !payload.data) return;
        const interval = payload.data.intervalMs ?? DEFAULT_REFRESH_INTERVAL;
        if (REFRESH_OPTIONS.some((option) => option.value === interval)) {
          setRefreshInterval(interval);
        }
        setIsRefreshPaused(Boolean(payload.data.paused));
      } catch {
        // Ignore refresh settings load errors
      }
    };

    void loadRefreshSettings();
    return () => {
      active = false;
    };
  }, [isSignedIn]);

  // -------------------------------------------------------------------------
  // Refresh settings save
  // -------------------------------------------------------------------------

  const saveRefreshSettings = useCallback(
    async (intervalMs: number, paused: boolean) => {
      if (!isSignedIn) return;
      try {
        await fetch('/api/settings/ge-refresh', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ intervalMs, paused }),
        });
      } catch {
        // Ignore refresh settings save errors
      }
    },
    [isSignedIn]
  );

  const handleRefreshIntervalChange = useCallback(
    (intervalMs: number) => {
      if (!REFRESH_OPTIONS.some((option) => option.value === intervalMs)) {
        return;
      }
      setRefreshInterval(intervalMs);
      void saveRefreshSettings(intervalMs, isRefreshPaused);
    },
    [isRefreshPaused, saveRefreshSettings]
  );

  const handleToggleRefreshPaused = useCallback(() => {
    const nextValue = !isRefreshPaused;
    setIsRefreshPaused(nextValue);
    void saveRefreshSettings(refreshInterval, nextValue);
  }, [isRefreshPaused, refreshInterval, saveRefreshSettings]);

  // -------------------------------------------------------------------------
  // Favorites save
  // -------------------------------------------------------------------------

  const saveFavorites = useCallback((newFavorites: Set<number>) => {
    try {
      localStorage.setItem(
        FAVORITES_STORAGE_KEY,
        JSON.stringify(Array.from(newFavorites))
      );
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const saveFavoriteMeta = useCallback(
    (meta: Record<number, { id: number; name: string; icon: string }>) => {
      try {
        localStorage.setItem(FAVORITES_META_STORAGE_KEY, JSON.stringify(meta));
      } catch {
        // Ignore localStorage errors
      }
    },
    []
  );

  // -------------------------------------------------------------------------
  // Presets save
  // -------------------------------------------------------------------------

  const savePresets = useCallback(
    async (presets: SavedPreset[]) => {
      if (!isSignedIn) return;
      try {
        await fetch('/api/settings/ge-presets', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(presets),
        });
      } catch {
        // Ignore preset save errors
      }
    },
    [isSignedIn]
  );

  // -------------------------------------------------------------------------
  // Toggle favorite
  // -------------------------------------------------------------------------

  const handleToggleFavorite = useCallback(
    (itemId: number) => {
      setFavorites((prev) => {
        const next = new Set(prev);
        let nextMeta: Record<
          number,
          { id: number; name: string; icon: string }
        > = {};
        try {
          const stored = localStorage.getItem(FAVORITES_META_STORAGE_KEY);
          if (stored) {
            nextMeta = JSON.parse(stored) as Record<
              number,
              { id: number; name: string; icon: string }
            >;
          }
        } catch {
          nextMeta = {};
        }
        if (next.has(itemId)) {
          next.delete(itemId);
          delete nextMeta[itemId];
          if (isSignedIn && activeCharacterId && watchMap[itemId]) {
            void fetch(`/api/characters/${activeCharacterId}/watchlist`, {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ watchItemId: watchMap[itemId] }),
            });
            setWatchMap((prevMap) => {
              const updated = { ...prevMap };
              delete updated[itemId];
              return updated;
            });
          }
        } else {
          next.add(itemId);
          const item = items.find((entry) => entry.id === itemId);
          if (item) {
            nextMeta[itemId] = {
              id: item.id,
              name: item.name,
              icon: item.icon,
            };
          }
          if (isSignedIn && activeCharacterId && !watchMap[itemId]) {
            const itemName = item?.name ?? `Item #${itemId}`;
            void fetch(`/api/characters/${activeCharacterId}/watchlist`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ itemId, itemName }),
            }).then(async (response) => {
              if (!response.ok) return;
              const payload = (await response.json()) as {
                data?: { id: string };
              };
              const watchId = payload.data?.id;
              if (watchId) {
                setWatchMap((prevMap) => ({
                  ...prevMap,
                  [itemId]: watchId,
                }));
              }
            });
          }
        }
        saveFavorites(next);
        saveFavoriteMeta(nextMeta);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('ge-favorites-updated'));
        }
        return next;
      });
    },
    [
      activeCharacterId,
      isSignedIn,
      items,
      saveFavoriteMeta,
      saveFavorites,
      watchMap,
    ]
  );

  // -------------------------------------------------------------------------
  // Fetch items
  // -------------------------------------------------------------------------

  const fetchItems = useCallback(
    async (params: {
      page?: number;
      sorts?: SortState[];
      search?: string;
      members?: MembersFilter;
      filters?: ColumnFilterState;
      hideNegativeMargin?: boolean;
      hideNegativeRoi?: boolean;
      minFlipQuality?: FlipQualityGrade | null;
      silent?: boolean;
    }) => {
      if (inFlightRef.current) {
        return;
      }
      inFlightRef.current = true;
      const shouldShowLoading = !params.silent;
      if (shouldShowLoading) {
        setIsLoading(true);
      }
      try {
        const queryParams = new URLSearchParams();
        queryParams.set('page', String(params.page ?? meta.page));
        const nextSorts = params.sorts ?? sortsRef.current;
        queryParams.set(
          'sort',
          nextSorts.map((entry) => entry.field).join(',')
        );
        queryParams.set(
          'order',
          nextSorts.map((entry) => entry.direction).join(',')
        );
        queryParams.set('limit', '25');
        const nextSearch = params.search ?? searchFilter;
        if (nextSearch) queryParams.set('search', nextSearch);

        const nextMembers = params.members ?? membersFilter;
        if (nextMembers === 'members') queryParams.set('members', 'true');
        if (nextMembers === 'f2p') queryParams.set('members', 'false');

        const nextFilters = params.filters ?? filters;
        const nextHideNegativeMargin =
          params.hideNegativeMargin ?? hideNegativeMargin;
        const nextHideNegativeRoi = params.hideNegativeRoi ?? hideNegativeRoi;

        // Resolve minFlipQuality: use param if explicitly provided, else current state
        const nextMinFlipQuality =
          params.minFlipQuality !== undefined
            ? params.minFlipQuality
            : minFlipQuality;

        if (nextFilters.buyPrice.min) {
          queryParams.set('minPrice', nextFilters.buyPrice.min);
        }
        if (nextFilters.buyPrice.max) {
          queryParams.set('maxPrice', nextFilters.buyPrice.max);
        }
        if (nextFilters.sellPrice.min) {
          queryParams.set('minSellPrice', nextFilters.sellPrice.min);
        }
        if (nextFilters.sellPrice.max) {
          queryParams.set('maxSellPrice', nextFilters.sellPrice.max);
        }
        if (nextFilters.margin.min) {
          queryParams.set('minMargin', nextFilters.margin.min);
        }
        if (nextFilters.margin.max) {
          queryParams.set('maxMargin', nextFilters.margin.max);
        }
        if (nextFilters.profit.min) {
          queryParams.set('minProfit', nextFilters.profit.min);
        }
        if (nextFilters.profit.max) {
          queryParams.set('maxProfit', nextFilters.profit.max);
        }
        if (nextFilters.roi.min) {
          queryParams.set('minRoi', nextFilters.roi.min);
        }
        if (nextFilters.roi.max) {
          queryParams.set('maxRoi', nextFilters.roi.max);
        }
        if (nextFilters.volume.min) {
          queryParams.set('minVolume', nextFilters.volume.min);
        }
        if (nextFilters.volume.max) {
          queryParams.set('maxVolume', nextFilters.volume.max);
        }
        if (nextFilters.potentialProfit.min) {
          queryParams.set(
            'minPotentialProfit',
            nextFilters.potentialProfit.min
          );
        }
        if (nextFilters.potentialProfit.max) {
          queryParams.set(
            'maxPotentialProfit',
            nextFilters.potentialProfit.max
          );
        }
        if (nextHideNegativeMargin && !nextFilters.margin.min) {
          queryParams.set('minMargin', '0');
        }
        if (nextHideNegativeRoi && !nextFilters.roi.min) {
          queryParams.set('minRoi', '0');
        }

        // Flip quality filter
        if (nextMinFlipQuality) {
          queryParams.set('minFlipQuality', nextMinFlipQuality);
        }

        const response = await fetch(
          `/api/ge/items?${queryParams.toString()}`,
          {
            cache: 'no-store',
          }
        );
        if (response.ok) {
          const data = (await response.json()) as ItemsApiResponse;
          setItems(data.data ?? []);
          setMeta({
            total: data.meta.total,
            page: data.meta.page,
            limit: data.meta.limit,
            totalPages: data.meta.totalPages,
          });
          const nextSorts = parseSorts(data.meta.sort, data.meta.order);
          if (!areSortsEqual(nextSorts, sortsRef.current)) {
            setSorts(nextSorts);
          }
          const updatedAt = new Date();
          setLastUpdated(updatedAt);
        }
      } catch (error) {
        console.error('Failed to fetch items:', error);
      } finally {
        inFlightRef.current = false;
        if (shouldShowLoading) {
          setIsLoading(false);
        }
      }
    },
    [
      meta.page,
      searchFilter,
      membersFilter,
      filters,
      hideNegativeMargin,
      hideNegativeRoi,
      minFlipQuality,
    ]
  );

  const fetchItemsRef = useRef(fetchItems);

  // -------------------------------------------------------------------------
  // Sort options
  // -------------------------------------------------------------------------

  const sortOptions = useMemo(
    () => [
      { value: 'profit:desc', label: 'Profit (High to Low)' },
      { value: 'profit:asc', label: 'Profit (Low to High)' },
      { value: 'margin:desc', label: 'Margin (High to Low)' },
      { value: 'margin:asc', label: 'Margin (Low to High)' },
      { value: 'roiPercent:desc', label: 'ROI (High to Low)' },
      { value: 'roiPercent:asc', label: 'ROI (Low to High)' },
      { value: 'tax:desc', label: 'Tax (High to Low)' },
      { value: 'tax:asc', label: 'Tax (Low to High)' },
      { value: 'buyPrice:desc', label: 'Buy Price (High to Low)' },
      { value: 'buyPrice:asc', label: 'Buy Price (Low to High)' },
      { value: 'sellPrice:desc', label: 'Sell Price (High to Low)' },
      { value: 'sellPrice:asc', label: 'Sell Price (Low to High)' },
      { value: 'volume:desc', label: 'Volume (High to Low)' },
      { value: 'volume:asc', label: 'Volume (Low to High)' },
      { value: 'buyLimit:desc', label: 'Buy Limit (High to Low)' },
      { value: 'buyLimit:asc', label: 'Buy Limit (Low to High)' },
      {
        value: 'potentialProfit:desc',
        label: 'Potential Profit (High to Low)',
      },
      { value: 'potentialProfit:asc', label: 'Potential Profit (Low to High)' },
      { value: 'flipQuality:desc', label: 'Flip Quality (Best)' },
      { value: 'flipQuality:asc', label: 'Flip Quality (Worst)' },
      { value: 'lastTrade:desc', label: 'Last Trade (Newest)' },
      { value: 'lastTrade:asc', label: 'Last Trade (Oldest)' },
      { value: 'name:asc', label: 'Name (A to Z)' },
      { value: 'name:desc', label: 'Name (Z to A)' },
    ],
    []
  );

  // -------------------------------------------------------------------------
  // Ref syncs
  // -------------------------------------------------------------------------

  useEffect(() => {
    fetchItemsRef.current = fetchItems;
  }, [fetchItems]);

  useEffect(() => {
    sortsRef.current = sorts;
  }, [sorts]);

  useEffect(() => {
    pageRef.current = meta.page;
  }, [meta.page]);

  // -------------------------------------------------------------------------
  // Sort handlers
  // -------------------------------------------------------------------------

  const handleSort = useCallback(
    (field: SortField, additive: boolean) => {
      const existingIndex = sorts.findIndex((entry) => entry.field === field);
      const baseDirection: SortDirection =
        existingIndex === -1
          ? 'desc'
          : sorts[existingIndex]?.direction === 'desc'
            ? 'asc'
            : 'desc';

      const nextSorts = additive
        ? [
            ...sorts.filter((entry) => entry.field !== field),
            { field, direction: baseDirection },
          ]
        : [{ field, direction: baseDirection }];

      setSorts(nextSorts);
      void fetchItems({ page: 1, sorts: nextSorts });
    },
    [fetchItems, sorts]
  );

  const sortValue = useMemo(() => {
    const primary = sorts[0];
    const value = primary
      ? `${primary.field}:${primary.direction}`
      : 'profit:desc';
    return sortOptions.some((option) => option.value === value)
      ? value
      : 'profit:desc';
  }, [sortOptions, sorts]);

  const handleSortChange = useCallback(
    (value: string) => {
      const [field, direction] = value.split(':');
      if (!field) return;
      const nextSorts: SortState[] = [
        {
          field: field as SortField,
          direction: direction === 'asc' ? 'asc' : 'desc',
        },
      ];
      setSorts(nextSorts);
      void fetchItems({ page: 1, sorts: nextSorts });
    },
    [fetchItems]
  );

  // -------------------------------------------------------------------------
  // Pagination
  // -------------------------------------------------------------------------

  const handlePageChange = useCallback(
    (page: number) => {
      void fetchItems({ page });
    },
    [fetchItems]
  );

  // -------------------------------------------------------------------------
  // Search
  // -------------------------------------------------------------------------

  const handleSearchSubmit = useCallback(() => {
    void fetchItems({ page: 1, search: searchFilter });
  }, [searchFilter, fetchItems]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchItemsRef.current({
        page: 1,
        search: searchFilter,
        members: membersFilter,
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [searchFilter, membersFilter]);

  // -------------------------------------------------------------------------
  // Auto-refresh
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (isRefreshPaused) {
      setNextRefreshAt(null);
      return;
    }
    setNextRefreshAt(Date.now() + refreshInterval);
  }, [isRefreshPaused, refreshInterval]);

  useEffect(() => {
    if (isRefreshPaused) return;
    const tick = () => {
      setNextRefreshAt(Date.now() + refreshInterval);
      void fetchItemsRef.current({ page: pageRef.current, silent: true });
    };
    const intervalId = window.setInterval(tick, refreshInterval);
    return () => window.clearInterval(intervalId);
  }, [refreshInterval, isRefreshPaused]);

  // -------------------------------------------------------------------------
  // Navigation handlers
  // -------------------------------------------------------------------------

  const handleItemClick = useCallback(
    (item: { id: number }) => {
      router.push(`/trading/item/${item.id}`);
    },
    [router]
  );

  const handleSearchSelect = useCallback(
    (item: ItemSearchResult) => {
      router.push(`/trading/item/${item.id}`);
    },
    [router]
  );

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
  }, []);

  // -------------------------------------------------------------------------
  // Reset filters
  // -------------------------------------------------------------------------

  const handleResetFilters = useCallback(() => {
    setSearchFilter('');
    setMembersFilter('all');
    setFilters(DEFAULT_FILTERS);
    setHideNegativeMargin(false);
    setHideNegativeRoi(false);
    setActivePresets(new Set());
    setMinFlipQuality(null);
    setSmartFilterBankroll(null);
    void fetchItems({
      page: 1,
      search: '',
      members: 'all',
      filters: DEFAULT_FILTERS,
      hideNegativeMargin: false,
      hideNegativeRoi: false,
      minFlipQuality: null,
    });
  }, [fetchItems]);

  // -------------------------------------------------------------------------
  // Column filter handlers
  // -------------------------------------------------------------------------

  const updateFilterValue = useCallback(
    (key: ColumnFilterKey, field: 'min' | 'max', value: string) => {
      setFilters((prev) => ({
        ...prev,
        [key]: {
          ...prev[key],
          [field]: value,
        },
      }));
    },
    []
  );

  const applyColumnFilters = useCallback(
    (key?: ColumnFilterKey) => {
      const nextFilters =
        key === undefined ? filters : { ...filters, [key]: filters[key] };
      const normalized = normalizeFilters(nextFilters);
      setFilters(normalized);
      void fetchItems({
        page: 1,
        search: searchFilter,
        members: membersFilter,
        filters: normalized,
        hideNegativeMargin,
        hideNegativeRoi,
      });
    },
    [
      fetchItems,
      filters,
      searchFilter,
      membersFilter,
      hideNegativeMargin,
      hideNegativeRoi,
    ]
  );

  const clearColumnFilter = useCallback(
    (key: ColumnFilterKey) => {
      const nextFilters = { ...filters, [key]: { min: '', max: '' } };
      setFilters(nextFilters);
      void fetchItems({
        page: 1,
        search: searchFilter,
        members: membersFilter,
        filters: nextFilters,
        hideNegativeMargin,
        hideNegativeRoi,
      });
    },
    [
      fetchItems,
      filters,
      searchFilter,
      membersFilter,
      hideNegativeMargin,
      hideNegativeRoi,
    ]
  );

  // -------------------------------------------------------------------------
  // Multi-preset toggle handler
  // -------------------------------------------------------------------------

  const handleTogglePreset = useCallback(
    (presetId: string) => {
      setActivePresets((prev) => {
        const next = new Set(prev);
        if (next.has(presetId)) {
          next.delete(presetId);
        } else {
          next.add(presetId);
        }

        // Merge all active presets into filters
        const merged = mergePresetFilters(
          DEFAULT_FILTERS,
          next,
          savedPresets
        );
        const normalized = normalizeFilters(merged);
        setFilters(normalized);

        // Also apply saved preset's hide toggles when activating a saved preset
        const saved = savedPresets.find((p) => p.id === presetId);
        if (saved && next.has(presetId)) {
          setHideNegativeMargin(saved.hideNegativeMargin);
          setHideNegativeRoi(saved.hideNegativeRoi);
          setMembersFilter(saved.members);
          void fetchItems({
            page: 1,
            search: searchFilter,
            members: saved.members,
            filters: normalized,
            hideNegativeMargin: saved.hideNegativeMargin,
            hideNegativeRoi: saved.hideNegativeRoi,
          });
        } else {
          void fetchItems({
            page: 1,
            search: searchFilter,
            members: membersFilter,
            filters: normalized,
            hideNegativeMargin,
            hideNegativeRoi,
          });
        }

        return next;
      });
    },
    [
      fetchItems,
      hideNegativeMargin,
      hideNegativeRoi,
      membersFilter,
      savedPresets,
      searchFilter,
    ]
  );

  // -------------------------------------------------------------------------
  // Save preset
  // -------------------------------------------------------------------------

  const handleSavePreset = useCallback(() => {
    const name = window.prompt('Preset name');
    if (!name || !name.trim()) return;
    const preset: SavedPreset = {
      id: crypto.randomUUID(),
      name: name.trim(),
      filters,
      members: membersFilter,
      hideNegativeMargin,
      hideNegativeRoi,
    };
    const updated = [...savedPresets, preset];
    setSavedPresets(updated);
    void savePresets(updated);
    // Auto-activate newly saved preset
    setActivePresets((prev) => new Set([...prev, preset.id]));
  }, [
    filters,
    membersFilter,
    hideNegativeMargin,
    hideNegativeRoi,
    savedPresets,
    savePresets,
  ]);

  // -------------------------------------------------------------------------
  // Hide negative margin/ROI toggle
  // -------------------------------------------------------------------------

  const handleNegativeToggle = useCallback(
    (type: 'margin' | 'roi') => {
      if (type === 'margin') {
        const nextValue = !hideNegativeMargin;
        setHideNegativeMargin(nextValue);
        void fetchItems({
          page: 1,
          search: searchFilter,
          members: membersFilter,
          filters,
          hideNegativeMargin: nextValue,
          hideNegativeRoi,
        });
      } else {
        const nextValue = !hideNegativeRoi;
        setHideNegativeRoi(nextValue);
        void fetchItems({
          page: 1,
          search: searchFilter,
          members: membersFilter,
          filters,
          hideNegativeMargin,
          hideNegativeRoi: nextValue,
        });
      }
    },
    [
      fetchItems,
      filters,
      hideNegativeMargin,
      hideNegativeRoi,
      membersFilter,
      searchFilter,
    ]
  );

  // -------------------------------------------------------------------------
  // Min flip quality change
  // -------------------------------------------------------------------------

  const handleMinFlipQualityChange = useCallback(
    (grade: FlipQualityGrade | null) => {
      setMinFlipQuality(grade);
      void fetchItems({
        page: 1,
        search: searchFilter,
        members: membersFilter,
        filters,
        hideNegativeMargin,
        hideNegativeRoi,
        minFlipQuality: grade,
      });
    },
    [
      fetchItems,
      filters,
      hideNegativeMargin,
      hideNegativeRoi,
      membersFilter,
      searchFilter,
    ]
  );

  // -------------------------------------------------------------------------
  // Find Me a Flip
  // -------------------------------------------------------------------------

  const handleFindMeAFlip = useCallback(() => {
    const currentBankroll = flipContext?.bankroll?.current ?? null;

    // If no bankroll set, redirect to tracker to set it up
    if (currentBankroll === null || currentBankroll <= 0) {
      router.push('/trading/tracker');
      return;
    }

    // Apply smart filters based on bankroll
    const thresholds = getSmartFilterThresholds(currentBankroll);

    const smartFilters: ColumnFilterState = {
      ...DEFAULT_FILTERS,
      profit: { min: thresholds.minProfit, max: '' },
      volume: { min: thresholds.minVolume, max: '' },
      roi: { min: thresholds.minRoi, max: '' },
      buyPrice: { min: '', max: thresholds.maxPrice },
    };

    const normalized = normalizeFilters(smartFilters);
    setFilters(normalized);
    setHideNegativeMargin(true);
    setMinFlipQuality(thresholds.minFlipQuality);
    setSmartFilterBankroll(currentBankroll);
    setActivePresets(new Set()); // Clear presets when using smart filter

    // Sort by profit desc
    const nextSorts: SortState[] = [{ field: 'profit', direction: 'desc' }];
    setSorts(nextSorts);

    void fetchItems({
      page: 1,
      sorts: nextSorts,
      search: '',
      members: membersFilter,
      filters: normalized,
      hideNegativeMargin: true,
      hideNegativeRoi: false,
      minFlipQuality: thresholds.minFlipQuality,
    });
  }, [fetchItems, flipContext, membersFilter]);

  // -------------------------------------------------------------------------
  // Clear smart filter
  // -------------------------------------------------------------------------

  const handleClearSmartFilter = useCallback(() => {
    setSmartFilterBankroll(null);
    handleResetFilters();
  }, [handleResetFilters]);

  // -------------------------------------------------------------------------
  // Bankroll setup modal
  // -------------------------------------------------------------------------

  const handleOpenBankrollSetup = useCallback(() => {
    // Redirect to tracker page — that's the single source of truth for bankroll
    router.push('/trading/tracker');
  }, [router]);

  // -------------------------------------------------------------------------
  // Display items (favorites filter)
  // -------------------------------------------------------------------------

  const displayItems = useMemo(() => {
    if (viewMode !== 'favorites') return items;
    return items.filter((item) => favorites.has(item.id));
  }, [favorites, items, viewMode]);

  const lastUpdatedLabel = lastUpdated
    ? lastUpdated.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    : '—';

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="exchange-client">
      <ExchangeControls
        activePresets={activePresets}
        filters={filters}
        flipContext={flipContext}
        hideNegativeMargin={hideNegativeMargin}
        hideNegativeRoi={hideNegativeRoi}
        isRefineOpen={isRefineOpen}
        isRefreshPaused={isRefreshPaused}
        isSignedIn={isSignedIn}
        lastUpdatedLabel={lastUpdatedLabel}
        membersFilter={membersFilter}
        minFlipQuality={minFlipQuality}
        nextRefreshAt={nextRefreshAt}
        refreshInterval={refreshInterval}
        savedPresets={savedPresets}
        smartFilterBankroll={smartFilterBankroll}
        sortOptions={sortOptions}
        sortValue={sortValue}
        viewMode={viewMode}
        onApplyFilters={() => applyColumnFilters()}
        onClearSmartFilter={handleClearSmartFilter}
        onCloseRefine={() => setIsRefineOpen(false)}
        onFilterChange={updateFilterValue}
        onFindMeAFlip={handleFindMeAFlip}
        onMembersFilterChange={setMembersFilter}
        onMinFlipQualityChange={handleMinFlipQualityChange}
        onOpenBankrollSetup={handleOpenBankrollSetup}
        onOpenRefine={() => setIsRefineOpen(true)}
        onRefreshIntervalChange={handleRefreshIntervalChange}
        onResetFilters={handleResetFilters}
        onSavePreset={handleSavePreset}
        onSearchSelect={handleSearchSelect}
        onSortChange={handleSortChange}
        onToggleNegative={handleNegativeToggle}
        onTogglePreset={handleTogglePreset}
        onToggleRefreshPaused={handleToggleRefreshPaused}
        onViewModeChange={handleViewModeChange}
      />

      {isLoading && (
        <div className="loading-overlay">
          <span className="loading-spinner" />
          Loading...
        </div>
      )}

      <div className="exchange-table-shell">
        <ExchangeTopbar
          currentPage={meta.page}
          searchFilter={searchFilter}
          totalPages={meta.totalPages}
          onPageChange={handlePageChange}
          onSearchChange={setSearchFilter}
          onSearchSubmit={handleSearchSubmit}
        />

        <ExchangeTable
          columnFilters={filters}
          currentPage={meta.page}
          favorites={favorites}
          items={displayItems}
          sorts={sorts}
          total={meta.total}
          totalPages={meta.totalPages}
          onColumnFilterApply={applyColumnFilters}
          onColumnFilterChange={updateFilterValue}
          onColumnFilterClear={clearColumnFilter}
          onItemClick={handleItemClick}
          onPageChange={handlePageChange}
          onSort={handleSort}
          onToggleFavorite={handleToggleFavorite}
        />
      </div>
    </div>
  );
}
