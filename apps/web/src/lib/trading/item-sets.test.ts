import { describe, expect, it } from 'vitest';

import {
  computeSetArbitrage,
  ITEM_SETS,
  scanSetArbitrage,
  type ItemSetMapping,
} from './item-sets';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const testSet: ItemSetMapping = {
  setId: 100,
  setName: 'Test armour set',
  components: [
    { itemId: 1, itemName: 'Helmet', quantity: 1 },
    { itemId: 2, itemName: 'Body', quantity: 1 },
    { itemId: 3, itemName: 'Legs', quantity: 1 },
  ],
};

// ---------------------------------------------------------------------------
// computeSetArbitrage
// ---------------------------------------------------------------------------

describe('computeSetArbitrage', () => {
  it('returns profit when buying set is cheaper than parts', () => {
    const prices = new Map<number, number | null>([
      [100, 10_000], // set costs 10k
      [1, 4_000], // helmet 4k
      [2, 5_000], // body 5k
      [3, 3_000], // legs 3k = total 12k
    ]);
    const result = computeSetArbitrage(testSet, prices);
    expect(result.profitBuySet).toBe(2_000); // 12k - 10k
    expect(result.direction).toBe('buy-set');
    expect(result.bestProfit).toBe(2_000);
  });

  it('returns profit when buying parts is cheaper than set', () => {
    const prices = new Map<number, number | null>([
      [100, 15_000], // set costs 15k
      [1, 4_000],
      [2, 5_000],
      [3, 3_000], // total 12k
    ]);
    const result = computeSetArbitrage(testSet, prices);
    expect(result.profitBuyParts).toBe(3_000); // 15k - 12k
    expect(result.direction).toBe('buy-parts');
    expect(result.bestProfit).toBe(3_000);
  });

  it('returns none when prices are equal', () => {
    const prices = new Map<number, number | null>([
      [100, 12_000],
      [1, 4_000],
      [2, 5_000],
      [3, 3_000],
    ]);
    const result = computeSetArbitrage(testSet, prices);
    expect(result.direction).toBe('none');
    expect(result.bestProfit).toBeNull();
  });

  it('handles missing set price', () => {
    const prices = new Map<number, number | null>([
      [1, 4_000],
      [2, 5_000],
      [3, 3_000],
    ]);
    const result = computeSetArbitrage(testSet, prices);
    expect(result.setPrice).toBeNull();
    expect(result.profitBuySet).toBeNull();
    expect(result.direction).toBe('none');
  });

  it('handles missing component price', () => {
    const prices = new Map<number, number | null>([
      [100, 10_000],
      [1, 4_000],
      // missing component 2 and 3
    ]);
    const result = computeSetArbitrage(testSet, prices);
    expect(result.componentsTotalPrice).toBeNull();
    expect(result.direction).toBe('none');
  });

  it('handles component quantities > 1', () => {
    const setWith2 = {
      ...testSet,
      components: [{ itemId: 1, itemName: 'Rune', quantity: 5 }],
    };
    const prices = new Map<number, number | null>([
      [100, 400], // set 400
      [1, 100], // rune 100 each, 5x = 500
    ]);
    const result = computeSetArbitrage(setWith2, prices);
    expect(result.componentsTotalPrice).toBe(500);
    expect(result.profitBuySet).toBe(100); // 500 - 400
    expect(result.direction).toBe('buy-set');
  });
});

// ---------------------------------------------------------------------------
// scanSetArbitrage
// ---------------------------------------------------------------------------

describe('scanSetArbitrage', () => {
  it('returns empty when no profitable sets', () => {
    const prices = new Map<number, number | null>();
    expect(scanSetArbitrage(prices)).toHaveLength(0);
  });

  it('sorts by best profit descending', () => {
    const prices = new Map<number, number | null>([
      // Fake prices for the first two Barrows sets
      [12873, 1_000_000], // Ahrim set
      [4708, 300_000],
      [4712, 400_000],
      [4714, 200_000],
      [4710, 300_000], // total 1.2M → buy set profit 200k
      [12875, 2_000_000], // Dharok set
      [4716, 600_000],
      [4720, 700_000],
      [4722, 500_000],
      [4718, 600_000], // total 2.4M → buy set profit 400k
    ]);
    const results = scanSetArbitrage(prices);
    if (results.length >= 2) {
      expect(results[0]!.bestProfit!).toBeGreaterThanOrEqual(
        results[1]!.bestProfit!
      );
    }
  });

  it('excludes sets with no profit', () => {
    // Set priced exactly at sum of parts
    const prices = new Map<number, number | null>([
      [12873, 1_200_000],
      [4708, 300_000],
      [4712, 400_000],
      [4714, 200_000],
      [4710, 300_000],
    ]);
    const results = scanSetArbitrage(prices);
    const ahrimResult = results.find((r) => r.set.setId === 12873);
    expect(ahrimResult).toBeUndefined(); // no profit, not included
  });
});

// ---------------------------------------------------------------------------
// ITEM_SETS data integrity
// ---------------------------------------------------------------------------

describe('ITEM_SETS', () => {
  it('contains at least 10 known sets', () => {
    expect(ITEM_SETS.length).toBeGreaterThanOrEqual(10);
  });

  it('each set has a unique setId', () => {
    const ids = ITEM_SETS.map((s) => s.setId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('each set has at least 2 components', () => {
    for (const set of ITEM_SETS) {
      expect(set.components.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('all component quantities are positive', () => {
    for (const set of ITEM_SETS) {
      for (const comp of set.components) {
        expect(comp.quantity).toBeGreaterThan(0);
      }
    }
  });
});
