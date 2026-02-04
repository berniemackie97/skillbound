import type {
  ColumnFilterState,
  MembersFilter,
} from './exchange-client.types';
import type { SortDirection, SortField, SortState } from './exchange-table';

export const formatCountdown = (ms: number) => {
  const clamped = Math.max(0, ms);
  const totalSeconds = Math.floor(clamped / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export const areSortsEqual = (a: SortState[], b: SortState[]) => {
  if (a.length !== b.length) return false;
  return a.every((entry, index) => {
    const other = b[index];
    return other?.field === entry.field && other.direction === entry.direction;
  });
};

export function parseMembersFilter(value: string | null): MembersFilter {
  if (value === 'true') return 'members';
  if (value === 'false') return 'f2p';
  if (value === 'members' || value === 'f2p') return value;
  return 'all';
}

export function parseParam(value: string | null): string {
  return value ?? '';
}

export function parseCompactNumber(value: string): string {
  const raw = value.trim().toLowerCase();
  if (!raw) return '';
  const match = raw.match(/^(-?\d+(\.\d+)?)([kmb])?$/);
  if (!match) return '';
  const num = Number.parseFloat(match[1] ?? '');
  if (!Number.isFinite(num)) return '';
  const suffix = match[3];
  const multiplier =
    suffix === 'b' ? 1_000_000_000 : suffix === 'm' ? 1_000_000 : suffix === 'k' ? 1_000 : 1;
  return String(Math.round(num * multiplier));
}

export function normalizeFilters(filters: ColumnFilterState): ColumnFilterState {
  const normalize = (value: string) => parseCompactNumber(value);
  return {
    buyPrice: { min: normalize(filters.buyPrice.min), max: normalize(filters.buyPrice.max) },
    sellPrice: { min: normalize(filters.sellPrice.min), max: normalize(filters.sellPrice.max) },
    margin: { min: normalize(filters.margin.min), max: normalize(filters.margin.max) },
    profit: { min: normalize(filters.profit.min), max: normalize(filters.profit.max) },
    roi: { min: normalize(filters.roi.min), max: normalize(filters.roi.max) },
    volume: { min: normalize(filters.volume.min), max: normalize(filters.volume.max) },
    potentialProfit: {
      min: normalize(filters.potentialProfit.min),
      max: normalize(filters.potentialProfit.max),
    },
  };
}

export function parseSorts(
  sort: string | undefined,
  order: string | undefined
): SortState[] {
  const sortParts = (sort ?? '').split(',').map((value) => value.trim()).filter(Boolean);
  const orderParts = (order ?? '').split(',').map((value) => value.trim()).filter(Boolean);
  if (sortParts.length === 0) {
    return [{ field: 'profit', direction: 'desc' }];
  }
  return sortParts
    .map((field, index) => {
      const direction: SortDirection = orderParts[index] === 'asc' ? 'asc' : 'desc';
      return { field: field as SortField, direction };
    })
    .filter((entry) =>
      [
        'name',
        'buyPrice',
        'sellPrice',
        'margin',
        'tax',
        'profit',
        'roiPercent',
        'volume',
        'buyLimit',
        'potentialProfit',
        'lastTrade',
      ].includes(entry.field)
    );
}
