import { describe, expect, it } from 'vitest';

import {
  analyzeMarginCheck,
  rankMarginChecks,
  type MarginCheckInput,
} from './margin-check';

// ---------------------------------------------------------------------------
// analyzeMarginCheck
// ---------------------------------------------------------------------------

describe('analyzeMarginCheck', () => {
  it('calculates net margin after tax', () => {
    const result = analyzeMarginCheck({
      itemId: 4151,
      itemName: 'Abyssal whip',
      instantBuyPrice: 2_500_000,
      instantSellPrice: 2_400_000,
    });

    expect(result.rawMargin).toBe(100_000);
    // Tax: floor(2,500,000 * 0.02) = 50,000
    expect(result.taxPerItem).toBe(50_000);
    expect(result.netMargin).toBe(50_000);
    expect(result.profitable).toBe(true);
  });

  it('detects unprofitable flip when tax exceeds margin', () => {
    const result = analyzeMarginCheck({
      itemId: 1,
      itemName: 'Low margin item',
      instantBuyPrice: 100_000,
      instantSellPrice: 99_000,
    });

    // Raw margin: 1,000. Tax: floor(100,000 * 0.02) = 2,000
    expect(result.rawMargin).toBe(1_000);
    expect(result.taxPerItem).toBe(2_000);
    expect(result.netMargin).toBe(-1_000);
    expect(result.profitable).toBe(false);
  });

  it('caps tax at 5M', () => {
    const result = analyzeMarginCheck({
      itemId: 1,
      itemName: 'Expensive item',
      instantBuyPrice: 1_000_000_000,
      instantSellPrice: 900_000_000,
    });

    expect(result.taxPerItem).toBe(5_000_000);
  });

  it('calculates projected profit for quantity', () => {
    const result = analyzeMarginCheck({
      itemId: 4151,
      itemName: 'Whip',
      instantBuyPrice: 2_500_000,
      instantSellPrice: 2_400_000,
      quantity: 10,
    });

    // Net margin: 50k per item * 10 = 500k
    expect(result.projectedProfit).toBe(500_000);
  });

  it('calculates full cycle profit with buy limit', () => {
    const result = analyzeMarginCheck({
      itemId: 4151,
      itemName: 'Whip',
      instantBuyPrice: 2_500_000,
      instantSellPrice: 2_400_000,
      buyLimit: 70,
    });

    // Net margin: 50k * 70 = 3.5M
    expect(result.projectedProfitFullCycle).toBe(3_500_000);
    // GP/hr: 3.5M / 4 = 875k
    expect(result.gpPerHour).toBe(875_000);
  });

  it('returns null projections when no quantity/limit', () => {
    const result = analyzeMarginCheck({
      itemId: 1,
      itemName: 'Item',
      instantBuyPrice: 1000,
      instantSellPrice: 900,
    });

    expect(result.projectedProfit).toBeNull();
    expect(result.projectedProfitFullCycle).toBeNull();
    expect(result.gpPerHour).toBeNull();
  });

  it('calculates margin check cost', () => {
    const result = analyzeMarginCheck({
      itemId: 1,
      itemName: 'Item',
      instantBuyPrice: 1000,
      instantSellPrice: 900,
    });

    // Cost: 1000 - 900 + tax(900) = 100 + floor(18) = 118
    expect(result.marginCheckCost).toBe(118);
  });

  it('calculates net margin percent', () => {
    const result = analyzeMarginCheck({
      itemId: 1,
      itemName: 'Item',
      instantBuyPrice: 1100,
      instantSellPrice: 1000,
    });

    // Raw: 100. Tax: floor(1100*0.02)=22. Net: 78. Pct: 78/1000 = 7.8%
    expect(result.netMarginPercent).toBe(7.8);
  });
});

// ---------------------------------------------------------------------------
// rankMarginChecks
// ---------------------------------------------------------------------------

describe('rankMarginChecks', () => {
  it('filters out unprofitable items', () => {
    const inputs: MarginCheckInput[] = [
      {
        itemId: 1,
        itemName: 'Good',
        instantBuyPrice: 10_000,
        instantSellPrice: 8_000,
      },
      {
        itemId: 2,
        itemName: 'Bad',
        instantBuyPrice: 10_000,
        instantSellPrice: 9_900,
      },
    ];
    const results = rankMarginChecks(inputs);
    expect(results.every((r) => r.profitable)).toBe(true);
    expect(results.find((r) => r.itemName === 'Bad')).toBeUndefined();
  });

  it('sorts by GP/hr when buy limits available', () => {
    const inputs: MarginCheckInput[] = [
      {
        itemId: 1,
        itemName: 'Low margin, high limit',
        instantBuyPrice: 5_000,
        instantSellPrice: 4_000,
        buyLimit: 10_000,
      },
      {
        itemId: 2,
        itemName: 'High margin, low limit',
        instantBuyPrice: 100_000,
        instantSellPrice: 80_000,
        buyLimit: 10,
      },
    ];
    const results = rankMarginChecks(inputs);
    expect(results.length).toBeGreaterThanOrEqual(1);
    if (results.length >= 2) {
      expect(results[0]!.gpPerHour!).toBeGreaterThanOrEqual(
        results[1]!.gpPerHour!
      );
    }
  });

  it('sorts by net margin when no buy limits', () => {
    const inputs: MarginCheckInput[] = [
      {
        itemId: 1,
        itemName: 'Small',
        instantBuyPrice: 5_000,
        instantSellPrice: 4_000,
      },
      {
        itemId: 2,
        itemName: 'Big',
        instantBuyPrice: 100_000,
        instantSellPrice: 80_000,
      },
    ];
    const results = rankMarginChecks(inputs);
    expect(results[0]!.itemName).toBe('Big');
  });

  it('returns empty for all unprofitable', () => {
    const inputs: MarginCheckInput[] = [
      {
        itemId: 1,
        itemName: 'Bad',
        instantBuyPrice: 100,
        instantSellPrice: 99,
      },
    ];
    expect(rankMarginChecks(inputs)).toHaveLength(0);
  });
});
