import { describe, expect, it } from 'vitest';

import {
  aggregateAccounts,
  findOverlappingItems,
  type AccountSummary,
} from './multi-account';

function makeAccount(overrides: Partial<AccountSummary> = {}): AccountSummary {
  return {
    characterId: 'char-1',
    characterName: 'Main',
    investedValue: 1_000_000,
    bankroll: 5_000_000,
    realisedPnL: 200_000,
    activePositions: 3,
    completedTrades: 50,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// aggregateAccounts
// ---------------------------------------------------------------------------

describe('aggregateAccounts', () => {
  it('returns defaults for empty input', () => {
    const result = aggregateAccounts([]);
    expect(result.totalInvested).toBe(0);
    expect(result.largestAccount).toBeNull();
    expect(result.overallRoi).toBeNull();
  });

  it('sums totals across accounts', () => {
    const accounts = [
      makeAccount({
        characterId: '1',
        characterName: 'Main',
        investedValue: 2_000_000,
        bankroll: 3_000_000,
        realisedPnL: 500_000,
        activePositions: 5,
        completedTrades: 100,
      }),
      makeAccount({
        characterId: '2',
        characterName: 'Alt',
        investedValue: 1_000_000,
        bankroll: 2_000_000,
        realisedPnL: -100_000,
        activePositions: 2,
        completedTrades: 30,
      }),
    ];
    const result = aggregateAccounts(accounts);

    expect(result.totalInvested).toBe(3_000_000);
    expect(result.totalBankroll).toBe(5_000_000);
    expect(result.totalRealisedPnL).toBe(400_000);
    expect(result.totalActivePositions).toBe(7);
    expect(result.totalCompletedTrades).toBe(130);
  });

  it('identifies largest account', () => {
    const accounts = [
      makeAccount({ characterName: 'Small', investedValue: 100_000 }),
      makeAccount({ characterName: 'Big', investedValue: 10_000_000 }),
    ];
    expect(aggregateAccounts(accounts).largestAccount).toBe('Big');
  });

  it('calculates overall ROI', () => {
    const accounts = [
      makeAccount({ investedValue: 1_000_000, realisedPnL: 200_000 }),
      makeAccount({ investedValue: 1_000_000, realisedPnL: 300_000 }),
    ];
    const result = aggregateAccounts(accounts);
    // Total P&L: 500k / Total invested: 2M = 25%
    expect(result.overallRoi).toBe(25);
  });

  it('returns null ROI when no investment', () => {
    const accounts = [makeAccount({ investedValue: 0, realisedPnL: 0 })];
    expect(aggregateAccounts(accounts).overallRoi).toBeNull();
  });

  it('preserves account list', () => {
    const accounts = [makeAccount(), makeAccount({ characterId: '2' })];
    expect(aggregateAccounts(accounts).accounts).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// findOverlappingItems
// ---------------------------------------------------------------------------

describe('findOverlappingItems', () => {
  it('finds items traded on multiple accounts', () => {
    const result = findOverlappingItems([
      {
        characterName: 'Main',
        items: [
          { itemId: 4151, itemName: 'Abyssal whip' },
          { itemId: 11832, itemName: 'Bandos chestplate' },
        ],
      },
      {
        characterName: 'Alt',
        items: [
          { itemId: 4151, itemName: 'Abyssal whip' },
          { itemId: 560, itemName: 'Death rune' },
        ],
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]!.itemId).toBe(4151);
    expect(result[0]!.accounts).toContain('Main');
    expect(result[0]!.accounts).toContain('Alt');
  });

  it('returns empty when no overlap', () => {
    const result = findOverlappingItems([
      {
        characterName: 'Main',
        items: [{ itemId: 4151, itemName: 'Whip' }],
      },
      {
        characterName: 'Alt',
        items: [{ itemId: 560, itemName: 'Death rune' }],
      },
    ]);
    expect(result).toHaveLength(0);
  });

  it('returns empty for single account', () => {
    const result = findOverlappingItems([
      {
        characterName: 'Main',
        items: [{ itemId: 4151, itemName: 'Whip' }],
      },
    ]);
    expect(result).toHaveLength(0);
  });
});
