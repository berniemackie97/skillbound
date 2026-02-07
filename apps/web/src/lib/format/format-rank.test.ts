import { describe, expect, it } from 'vitest';

import { formatRank } from './format-rank';

describe('formatRank', () => {
  it('returns Unranked for nullish or non-positive values', () => {
    expect(formatRank(null)).toBe('Unranked');
    expect(formatRank(undefined)).toBe('Unranked');
    expect(formatRank(-1)).toBe('Unranked');
    expect(formatRank(0)).toBe('Unranked');
  });

  it('formats positive ranks with grouping', () => {
    expect(formatRank(1234)).toBe('1,234');
  });
});
