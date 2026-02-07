import { formatNumber } from './format-number';

export function formatRank(rank: number | null | undefined): string {
  if (rank === null || rank === undefined) {
    return 'Unranked';
  }
  if (!Number.isFinite(rank) || rank <= 0) {
    return 'Unranked';
  }
  return formatNumber(rank);
}
