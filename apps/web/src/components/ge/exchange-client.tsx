'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
  const [presetValue, setPresetValue] = useState('custom');
  const [stackPresets, setStackPresets] = useState(false);
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

  const fetchItems = useCallback(
    async (params: {
      page?: number;
      sorts?: SortState[];
      search?: string;
      members?: MembersFilter;
      filters?: ColumnFilterState;
      hideNegativeMargin?: boolean;
      hideNegativeRoi?: boolean;
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
    ]
  );

  const fetchItemsRef = useRef(fetchItems);

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
      { value: 'lastTrade:desc', label: 'Last Trade (Newest)' },
      { value: 'lastTrade:asc', label: 'Last Trade (Oldest)' },
      { value: 'name:asc', label: 'Name (A to Z)' },
      { value: 'name:desc', label: 'Name (Z to A)' },
    ],
    []
  );

  useEffect(() => {
    fetchItemsRef.current = fetchItems;
  }, [fetchItems]);

  useEffect(() => {
    sortsRef.current = sorts;
  }, [sorts]);

  useEffect(() => {
    pageRef.current = meta.page;
  }, [meta.page]);

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

  const handlePageChange = useCallback(
    (page: number) => {
      void fetchItems({ page });
    },
    [fetchItems]
  );

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

  const handleResetFilters = useCallback(() => {
    setSearchFilter('');
    setMembersFilter('all');
    setFilters(DEFAULT_FILTERS);
    setHideNegativeMargin(false);
    setHideNegativeRoi(false);
    setPresetValue('custom');
    void fetchItems({
      page: 1,
      search: '',
      members: 'all',
      filters: DEFAULT_FILTERS,
      hideNegativeMargin: false,
      hideNegativeRoi: false,
    });
  }, [fetchItems]);

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

  const handlePresetChange = useCallback(
    (value: string) => {
      const baseFilters = stackPresets ? filters : DEFAULT_FILTERS;
      let nextFilters = baseFilters;
      setPresetValue(value);
      switch (value) {
        case 'high-margin':
          nextFilters = { ...baseFilters, margin: { min: '100000', max: '' } };
          break;
        case 'high-roi':
          nextFilters = { ...baseFilters, roi: { min: '5', max: '' } };
          break;
        case 'high-volume':
          nextFilters = { ...baseFilters, volume: { min: '500', max: '' } };
          break;
        case 'high-profit':
          nextFilters = { ...baseFilters, profit: { min: '100000', max: '' } };
          break;
        case 'high-potential':
          nextFilters = {
            ...baseFilters,
            potentialProfit: { min: '1000000', max: '' },
          };
          break;
        case 'low-price':
          nextFilters = { ...baseFilters, buyPrice: { min: '', max: '50000' } };
          break;
        case 'high-price':
          nextFilters = {
            ...baseFilters,
            buyPrice: { min: '1000000', max: '' },
          };
          break;
        case 'reset':
          nextFilters = DEFAULT_FILTERS;
          break;
        default:
          break;
      }
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
      hideNegativeMargin,
      hideNegativeRoi,
      membersFilter,
      searchFilter,
      stackPresets,
    ]
  );

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
    setPresetValue(preset.id);
  }, [
    filters,
    membersFilter,
    hideNegativeMargin,
    hideNegativeRoi,
    savedPresets,
    savePresets,
  ]);

  const handleSavedPresetSelect = useCallback(
    (value: string) => {
      const preset = savedPresets.find((entry) => entry.id === value);
      if (!preset) {
        handlePresetChange(value);
        return;
      }
      setPresetValue(preset.id);
      setMembersFilter(preset.members);
      setHideNegativeMargin(preset.hideNegativeMargin);
      setHideNegativeRoi(preset.hideNegativeRoi);
      const normalized = normalizeFilters(preset.filters);
      setFilters(normalized);
      void fetchItems({
        page: 1,
        search: searchFilter,
        members: preset.members,
        filters: normalized,
        hideNegativeMargin: preset.hideNegativeMargin,
        hideNegativeRoi: preset.hideNegativeRoi,
      });
    },
    [fetchItems, handlePresetChange, savedPresets, searchFilter]
  );

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

  return (
    <div className="exchange-client">
      <ExchangeControls
        filters={filters}
        hideNegativeMargin={hideNegativeMargin}
        hideNegativeRoi={hideNegativeRoi}
        isRefineOpen={isRefineOpen}
        isRefreshPaused={isRefreshPaused}
        lastUpdatedLabel={lastUpdatedLabel}
        membersFilter={membersFilter}
        nextRefreshAt={nextRefreshAt}
        presetValue={presetValue}
        refreshInterval={refreshInterval}
        savedPresets={savedPresets}
        sortOptions={sortOptions}
        sortValue={sortValue}
        stackPresets={stackPresets}
        viewMode={viewMode}
        onApplyFilters={() => applyColumnFilters()}
        onCloseRefine={() => setIsRefineOpen(false)}
        onFilterChange={updateFilterValue}
        onMembersFilterChange={setMembersFilter}
        onOpenRefine={() => setIsRefineOpen(true)}
        onPresetSelect={handleSavedPresetSelect}
        onRefreshIntervalChange={handleRefreshIntervalChange}
        onResetFilters={handleResetFilters}
        onSavePreset={handleSavePreset}
        onSearchSelect={handleSearchSelect}
        onSortChange={handleSortChange}
        onToggleNegative={handleNegativeToggle}
        onToggleRefreshPaused={handleToggleRefreshPaused}
        onToggleStackPresets={() => setStackPresets((prev) => !prev)}
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
