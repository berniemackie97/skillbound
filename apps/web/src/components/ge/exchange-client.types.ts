import type { ExchangeItem } from './exchange-table';

export interface ItemsApiResponse {
  data?: ExchangeItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    sort: string;
    order: string;
  };
}

export type ViewMode = 'catalog' | 'favorites';
export type MembersFilter = 'all' | 'members' | 'f2p';

export type ColumnFilterKey =
  | 'buyPrice'
  | 'sellPrice'
  | 'margin'
  | 'profit'
  | 'roi'
  | 'volume'
  | 'potentialProfit';

export type ColumnFilterState = Record<
  ColumnFilterKey,
  { min: string; max: string }
>;

export type SavedPreset = {
  id: string;
  name: string;
  filters: ColumnFilterState;
  members: MembersFilter;
  hideNegativeMargin: boolean;
  hideNegativeRoi: boolean;
};

export interface ExchangeClientProps {
  initialItems: ExchangeItem[];
  initialMeta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    sort: string;
    order: string;
  };
}
