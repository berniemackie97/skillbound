import { describe, expect, it } from 'vitest';

import {
  analyzeJournal,
  filterByTags,
  getEntriesForItem,
  searchJournal,
  type JournalEntry,
} from './trade-journal';

const d = (day: number) => new Date(2025, 0, day);

function makeEntry(overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: 'j-1',
    title: 'Test entry',
    body: 'Some notes about the trade.',
    outcome: 'profit',
    tags: ['planned'],
    createdAt: d(1),
    updatedAt: d(1),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// analyzeJournal
// ---------------------------------------------------------------------------

describe('analyzeJournal', () => {
  it('returns defaults for empty input', () => {
    const result = analyzeJournal([]);
    expect(result.totalEntries).toBe(0);
    expect(result.avgConfidenceBefore).toBeNull();
    expect(result.emotionalLossRate).toBeNull();
  });

  it('counts outcome breakdown', () => {
    const entries = [
      makeEntry({ id: '1', outcome: 'profit' }),
      makeEntry({ id: '2', outcome: 'profit' }),
      makeEntry({ id: '3', outcome: 'loss' }),
    ];
    const result = analyzeJournal(entries);
    expect(result.outcomeBreakdown.profit).toBe(2);
    expect(result.outcomeBreakdown.loss).toBe(1);
    expect(result.outcomeBreakdown.breakeven).toBe(0);
  });

  it('counts tag frequency', () => {
    const entries = [
      makeEntry({ id: '1', tags: ['flip', 'planned'] }),
      makeEntry({ id: '2', tags: ['flip', 'impulse'] }),
    ];
    const result = analyzeJournal(entries);
    expect(result.tagFrequency.flip).toBe(2);
    expect(result.tagFrequency.planned).toBe(1);
    expect(result.tagFrequency.impulse).toBe(1);
  });

  it('computes average confidence', () => {
    const entries = [
      makeEntry({ id: '1', confidenceBefore: 4, confidenceAfter: 3 }),
      makeEntry({ id: '2', confidenceBefore: 2, confidenceAfter: 5 }),
    ];
    const result = analyzeJournal(entries);
    expect(result.avgConfidenceBefore).toBe(3);
    expect(result.avgConfidenceAfter).toBe(4);
  });

  it('computes emotional loss rate', () => {
    const entries = [
      makeEntry({ id: '1', tags: ['impulse'], outcome: 'loss' }),
      makeEntry({ id: '2', tags: ['fomo-buy'], outcome: 'loss' }),
      makeEntry({ id: '3', tags: ['panic-sell'], outcome: 'profit' }),
    ];
    const result = analyzeJournal(entries);
    expect(result.emotionalTradeCount).toBe(3);
    // 2 losses out of 3 emotional = 66.67%
    expect(result.emotionalLossRate).toBeCloseTo(66.67, 0);
  });

  it('computes planned win rate', () => {
    const entries = [
      makeEntry({ id: '1', tags: ['planned'], outcome: 'profit' }),
      makeEntry({ id: '2', tags: ['planned'], outcome: 'profit' }),
      makeEntry({ id: '3', tags: ['planned'], outcome: 'loss' }),
    ];
    const result = analyzeJournal(entries);
    expect(result.plannedTradeCount).toBe(3);
    // 2/3 = 66.67%
    expect(result.plannedWinRate).toBeCloseTo(66.67, 0);
  });

  it('handles entries with no confidence ratings', () => {
    const entries = [makeEntry({ id: '1' })];
    const result = analyzeJournal(entries);
    expect(result.avgConfidenceBefore).toBeNull();
    expect(result.avgConfidenceAfter).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// searchJournal
// ---------------------------------------------------------------------------

describe('searchJournal', () => {
  it('searches title and body', () => {
    const entries = [
      makeEntry({ id: '1', title: 'Whip flip', body: 'Bought cheap.' }),
      makeEntry({ id: '2', title: 'Bond trade', body: 'Sold at peak.' }),
    ];
    expect(searchJournal(entries, 'whip')).toHaveLength(1);
    expect(searchJournal(entries, 'peak')).toHaveLength(1);
    expect(searchJournal(entries, 'nothing')).toHaveLength(0);
  });

  it('is case insensitive', () => {
    const entries = [makeEntry({ id: '1', title: 'Abyssal Whip' })];
    expect(searchJournal(entries, 'abyssal')).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// filterByTags
// ---------------------------------------------------------------------------

describe('filterByTags', () => {
  it('filters entries matching any tag', () => {
    const entries = [
      makeEntry({ id: '1', tags: ['flip', 'planned'] }),
      makeEntry({ id: '2', tags: ['investment'] }),
      makeEntry({ id: '3', tags: ['impulse'] }),
    ];
    const result = filterByTags(entries, ['flip', 'impulse']);
    expect(result).toHaveLength(2);
  });

  it('returns empty for no matches', () => {
    const entries = [makeEntry({ id: '1', tags: ['planned'] })];
    expect(filterByTags(entries, ['impulse'])).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// getEntriesForItem
// ---------------------------------------------------------------------------

describe('getEntriesForItem', () => {
  it('filters by itemId', () => {
    const entries = [
      makeEntry({ id: '1', itemId: 4151 }),
      makeEntry({ id: '2', itemId: 11832 }),
      makeEntry({ id: '3', itemId: 4151 }),
    ];
    expect(getEntriesForItem(entries, 4151)).toHaveLength(2);
  });

  it('returns empty when no entries match', () => {
    const entries = [makeEntry({ id: '1', itemId: 4151 })];
    expect(getEntriesForItem(entries, 999)).toHaveLength(0);
  });
});
