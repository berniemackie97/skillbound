import { describe, expect, it } from 'vitest';

import {
  analyzeCofferItem,
  calculateBatchCofferValue,
  calculateCofferValue,
  findBestCofferItems,
  type CofferItem,
} from './deaths-coffer';

// ---------------------------------------------------------------------------
// calculateCofferValue
// ---------------------------------------------------------------------------

describe('calculateCofferValue', () => {
  it('applies 105% multiplier', () => {
    expect(calculateCofferValue(100_000)).toBe(105_000);
  });

  it('floors the result', () => {
    expect(calculateCofferValue(101)).toBe(106); // 101 * 1.05 = 106.05 → 106
  });

  it('handles zero', () => {
    expect(calculateCofferValue(0)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// analyzeCofferItem
// ---------------------------------------------------------------------------

describe('analyzeCofferItem', () => {
  it('returns analysis for profitable item', () => {
    const item: CofferItem = {
      itemId: 1,
      itemName: 'Test item',
      buyPrice: 90_000,
      guidePrice: 100_000,
    };
    const result = analyzeCofferItem(item);

    expect(result).not.toBeNull();
    expect(result!.cofferValue).toBe(105_000);
    expect(result!.profitPerItem).toBe(15_000); // 105k - 90k
    expect(result!.roi).toBeGreaterThan(0);
  });

  it('returns null for unprofitable item', () => {
    const item: CofferItem = {
      itemId: 1,
      itemName: 'Overpriced',
      buyPrice: 110_000,
      guidePrice: 100_000,
    };
    expect(analyzeCofferItem(item)).toBeNull();
  });

  it('returns null when buyPrice equals cofferValue', () => {
    const item: CofferItem = {
      itemId: 1,
      itemName: 'Break even',
      buyPrice: 105_000,
      guidePrice: 100_000,
    };
    expect(analyzeCofferItem(item)).toBeNull();
  });

  it('calculates ROI correctly', () => {
    const item: CofferItem = {
      itemId: 1,
      itemName: 'Good deal',
      buyPrice: 50_000,
      guidePrice: 100_000,
    };
    const result = analyzeCofferItem(item)!;
    // Profit: 105k - 50k = 55k. ROI: 55k/50k = 110%
    expect(result.roi).toBe(110);
  });
});

// ---------------------------------------------------------------------------
// findBestCofferItems
// ---------------------------------------------------------------------------

describe('findBestCofferItems', () => {
  const items: CofferItem[] = [
    { itemId: 1, itemName: 'Best', buyPrice: 50_000, guidePrice: 100_000 },
    { itemId: 2, itemName: 'Good', buyPrice: 90_000, guidePrice: 100_000 },
    { itemId: 3, itemName: 'Bad', buyPrice: 110_000, guidePrice: 100_000 },
    { itemId: 4, itemName: 'Tiny', buyPrice: 99_990, guidePrice: 100_000 },
  ];

  it('filters out unprofitable items', () => {
    const results = findBestCofferItems(items);
    expect(results.every((r) => r.profitPerItem > 0)).toBe(true);
    expect(results.find((r) => r.itemName === 'Bad')).toBeUndefined();
  });

  it('sorts by profit descending', () => {
    const results = findBestCofferItems(items);
    expect(results[0]!.itemName).toBe('Best');
  });

  it('respects minProfit filter', () => {
    const results = findBestCofferItems(items, 10_000);
    // Only 'Best' (55k profit) and 'Good' (15k profit) should pass
    expect(results).toHaveLength(2);
  });

  it('returns empty for all unprofitable items', () => {
    const badItems: CofferItem[] = [
      { itemId: 1, itemName: 'Bad', buyPrice: 200_000, guidePrice: 100_000 },
    ];
    expect(findBestCofferItems(badItems)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// calculateBatchCofferValue
// ---------------------------------------------------------------------------

describe('calculateBatchCofferValue', () => {
  it('sums coffer values for a batch', () => {
    const batch = [
      { guidePrice: 100_000, quantity: 2 },
      { guidePrice: 50_000, quantity: 3 },
    ];
    // 105_000 * 2 + 52_500 * 3 = 210_000 + 157_500 = 367_500
    expect(calculateBatchCofferValue(batch)).toBe(367_500);
  });

  it('returns 0 for empty batch', () => {
    expect(calculateBatchCofferValue([])).toBe(0);
  });
});
