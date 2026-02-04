import type { ColumnFilterState } from './exchange-client.types';

export const FAVORITES_STORAGE_KEY = 'skillbound:ge-favorites';
export const FAVORITES_META_STORAGE_KEY = 'skillbound:ge-favorites-meta';

export const REFRESH_OPTIONS = [
  { label: '30s', value: 30_000 },
  { label: '45s', value: 45_000 },
  { label: '60s', value: 60_000 },
  { label: '90s', value: 90_000 },
  { label: '120s', value: 120_000 },
] as const;

export const DEFAULT_REFRESH_INTERVAL = 45_000;

export const DEFAULT_FILTERS: ColumnFilterState = {
  buyPrice: { min: '', max: '' },
  sellPrice: { min: '', max: '' },
  margin: { min: '', max: '' },
  profit: { min: '', max: '' },
  roi: { min: '', max: '' },
  volume: { min: '', max: '' },
  potentialProfit: { min: '', max: '' },
};
