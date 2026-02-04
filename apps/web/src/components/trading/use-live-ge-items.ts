'use client';

import { useEffect, useMemo, useState } from 'react';

import type { GeExchangeItem } from '@/lib/trading/ge-service';

type LiveItem = Pick<
  GeExchangeItem,
  | 'id'
  | 'name'
  | 'icon'
  | 'buyPrice'
  | 'sellPrice'
  | 'margin'
  | 'profit'
  | 'roiPercent'
  | 'volume'
  | 'avgHighPrice'
  | 'avgLowPrice'
  | 'volume5m'
  | 'volume1h'
  | 'avgHighPrice5m'
  | 'avgLowPrice5m'
  | 'avgHighPrice1h'
  | 'avgLowPrice1h'
>;

type LiveItemsResponse = {
  data?: LiveItem[];
};

type UseLiveGeItemsOptions = {
  refreshMs?: number;
};

export function useLiveGeItems(ids: number[], options: UseLiveGeItemsOptions = {}) {
  const refreshMs = options.refreshMs ?? 45_000;
  const idsKey = useMemo(() => {
    const unique = Array.from(new Set(ids.filter((id) => Number.isFinite(id))));
    unique.sort((a, b) => a - b);
    return unique.join(',');
  }, [ids]);
  const normalizedIds = useMemo(
    () => (idsKey ? idsKey.split(',').map((id) => Number.parseInt(id, 10)) : []),
    [idsKey]
  );
  const [items, setItems] = useState<Record<number, LiveItem>>({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!idsKey) {
      setItems({});
      setIsLoading(false);
      return;
    }

    let active = true;
    let interval: NodeJS.Timeout | null = null;

    const fetchLiveItems = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/ge/items?ids=${idsKey}`);
        if (!response.ok) return;
        const payload = (await response.json()) as LiveItemsResponse;
        const nextItems: Record<number, LiveItem> = {};
        for (const item of payload.data ?? []) {
          nextItems[item.id] = item;
        }
        if (active) {
          setItems(nextItems);
        }
      } catch {
        // Ignore live refresh errors
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void fetchLiveItems();
    interval = setInterval(fetchLiveItems, refreshMs);

    return () => {
      active = false;
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [idsKey, refreshMs]);

  return { items, isLoading, ids: normalizedIds };
}
