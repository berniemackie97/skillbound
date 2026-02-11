import { describe, expect, it } from 'vitest';

import {
  calculateFlipQualityScore,
  GRADE_ORDER,
  meetsMinimumGrade,
  type FlipQualityGrade,
  type FlipScoringInput,
} from './flip-scoring';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOW = new Date('2026-02-11T12:00:00Z');

/** Base input with reasonable defaults — override fields as needed */
function makeInput(overrides: Partial<FlipScoringInput> = {}): FlipScoringInput {
  return {
    buyPrice: 1000,
    sellPrice: 900,
    buyPriceTime: new Date(NOW.getTime() - 2 * 60 * 1000), // 2 min ago
    sellPriceTime: new Date(NOW.getTime() - 3 * 60 * 1000), // 3 min ago
    margin: 100,
    tax: 10,
    avgHighPrice5m: 1010,
    avgLowPrice5m: 910,
    volume5m: 50,
    highPriceVolume5m: 30,
    lowPriceVolume5m: 20,
    avgHighPrice1h: 1005,
    avgLowPrice1h: 905,
    volume1h: 500,
    highPriceVolume1h: 300,
    lowPriceVolume1h: 200,
    buyLimit: 100,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// calculateFlipQualityScore
// ---------------------------------------------------------------------------

describe('calculateFlipQualityScore', () => {
  it('returns a complete FlipQualityScore object', () => {
    const result = calculateFlipQualityScore(makeInput(), NOW);

    expect(result).toHaveProperty('grade');
    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('breakdown');
    expect(result).toHaveProperty('flags');
    expect(typeof result.score).toBe('number');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(['A', 'B', 'C', 'D', 'F']).toContain(result.grade);
    expect(Array.isArray(result.flags)).toBe(true);
  });

  it('breakdown contains all six sub-scores between 0-100', () => {
    const { breakdown } = calculateFlipQualityScore(makeInput(), NOW);

    for (const key of [
      'liquidity',
      'staleness',
      'marginStability',
      'volumeAdequacy',
      'buyPressure',
      'taxEfficiency',
    ] as const) {
      expect(breakdown[key]).toBeGreaterThanOrEqual(0);
      expect(breakdown[key]).toBeLessThanOrEqual(100);
    }
  });

  // -- Grade mapping --

  it('grades a high-quality item as A or B', () => {
    const input = makeInput({
      volume1h: 2000,
      margin: 100,
      tax: 5,
      buyLimit: 100,
      highPriceVolume1h: 1400,
      lowPriceVolume1h: 600,
    });
    const result = calculateFlipQualityScore(input, NOW);
    expect(['A', 'B']).toContain(result.grade);
    expect(result.score).toBeGreaterThanOrEqual(70);
  });

  it('grades a dead/stale item as D or F', () => {
    const input = makeInput({
      volume1h: 0,
      volume5m: 0,
      buyPriceTime: null,
      sellPriceTime: null,
      margin: null,
      tax: null,
      avgHighPrice5m: null,
      avgLowPrice5m: null,
      avgHighPrice1h: null,
      avgLowPrice1h: null,
      highPriceVolume1h: null,
      lowPriceVolume1h: null,
      highPriceVolume5m: null,
      lowPriceVolume5m: null,
    });
    const result = calculateFlipQualityScore(input, NOW);
    expect(['D', 'F']).toContain(result.grade);
    expect(result.score).toBeLessThan(55);
  });

  // -- Liquidity sub-score --

  it('liquidity: scores 0 for zero volume', () => {
    const result = calculateFlipQualityScore(
      makeInput({ volume1h: 0, volume5m: 0 }),
      NOW
    );
    expect(result.breakdown.liquidity).toBe(0);
  });

  it('liquidity: scores 100 for 1000+ volume', () => {
    const result = calculateFlipQualityScore(
      makeInput({ volume1h: 1500 }),
      NOW
    );
    expect(result.breakdown.liquidity).toBe(100);
  });

  it('liquidity: uses volume5m as fallback when volume1h is null', () => {
    const result = calculateFlipQualityScore(
      makeInput({ volume1h: null, volume5m: 200 }),
      NOW
    );
    expect(result.breakdown.liquidity).toBe(55);
  });

  // -- Staleness sub-score --

  it('staleness: scores 100 for prices under 5 minutes old', () => {
    const result = calculateFlipQualityScore(
      makeInput({
        buyPriceTime: new Date(NOW.getTime() - 2 * 60 * 1000),
        sellPriceTime: new Date(NOW.getTime() - 3 * 60 * 1000),
      }),
      NOW
    );
    expect(result.breakdown.staleness).toBe(100);
  });

  it('staleness: scores 10 for null price times', () => {
    const result = calculateFlipQualityScore(
      makeInput({ buyPriceTime: null, sellPriceTime: null }),
      NOW
    );
    expect(result.breakdown.staleness).toBe(10);
  });

  it('staleness: uses oldest price for scoring', () => {
    const result = calculateFlipQualityScore(
      makeInput({
        buyPriceTime: new Date(NOW.getTime() - 2 * 60 * 1000), // 2 min
        sellPriceTime: new Date(NOW.getTime() - 2 * 60 * 60 * 1000), // 2 hours
      }),
      NOW
    );
    // 2 hours > 1 hour → score 40
    expect(result.breakdown.staleness).toBe(40);
  });

  // -- Margin Stability sub-score --

  it('marginStability: scores high when live margin matches averages', () => {
    const result = calculateFlipQualityScore(
      makeInput({
        margin: 100,
        avgHighPrice5m: 1050,
        avgLowPrice5m: 950,
        avgHighPrice1h: 1050,
        avgLowPrice1h: 950,
      }),
      NOW
    );
    // Live margin is 100, avg margin is also 100 — perfect match
    expect(result.breakdown.marginStability).toBe(100);
  });

  it('marginStability: scores 30 when no average data available', () => {
    const result = calculateFlipQualityScore(
      makeInput({
        avgHighPrice5m: null,
        avgLowPrice5m: null,
        avgHighPrice1h: null,
        avgLowPrice1h: null,
      }),
      NOW
    );
    expect(result.breakdown.marginStability).toBe(30);
  });

  it('marginStability: scores 30 when margin is null', () => {
    const result = calculateFlipQualityScore(
      makeInput({ margin: null }),
      NOW
    );
    expect(result.breakdown.marginStability).toBe(30);
  });

  // -- Volume Adequacy sub-score --

  it('volumeAdequacy: scores 100 when volume is 2x+ buy limit', () => {
    const result = calculateFlipQualityScore(
      makeInput({ volume1h: 200, buyLimit: 100 }),
      NOW
    );
    expect(result.breakdown.volumeAdequacy).toBe(100);
  });

  it('volumeAdequacy: scores 50 when buyLimit is null', () => {
    const result = calculateFlipQualityScore(
      makeInput({ buyLimit: null }),
      NOW
    );
    expect(result.breakdown.volumeAdequacy).toBe(50);
  });

  it('volumeAdequacy: scores 30 when volume is 0', () => {
    const result = calculateFlipQualityScore(
      makeInput({ volume1h: 0, volume5m: 0 }),
      NOW
    );
    expect(result.breakdown.volumeAdequacy).toBe(30);
  });

  // -- Buy Pressure sub-score --

  it('buyPressure: scores 100 when buyer ratio is above 70%', () => {
    const result = calculateFlipQualityScore(
      makeInput({ highPriceVolume1h: 800, lowPriceVolume1h: 200 }),
      NOW
    );
    expect(result.breakdown.buyPressure).toBe(100);
  });

  it('buyPressure: scores 50 (neutral) when volumes are null', () => {
    const result = calculateFlipQualityScore(
      makeInput({
        highPriceVolume1h: null,
        lowPriceVolume1h: null,
        highPriceVolume5m: null,
        lowPriceVolume5m: null,
      }),
      NOW
    );
    expect(result.breakdown.buyPressure).toBe(50);
  });

  it('buyPressure: falls back to 5m data when 1h is null', () => {
    const result = calculateFlipQualityScore(
      makeInput({
        highPriceVolume1h: null,
        lowPriceVolume1h: null,
        highPriceVolume5m: 80,
        lowPriceVolume5m: 20,
      }),
      NOW
    );
    // 80/100 = 80% buyer ratio → score 100
    expect(result.breakdown.buyPressure).toBe(100);
  });

  // -- Tax Efficiency sub-score --

  it('taxEfficiency: scores 100 when tax is under 10% of margin', () => {
    const result = calculateFlipQualityScore(
      makeInput({ margin: 1000, tax: 50 }),
      NOW
    );
    expect(result.breakdown.taxEfficiency).toBe(100);
  });

  it('taxEfficiency: scores 10 when margin is 0 or negative', () => {
    const result = calculateFlipQualityScore(
      makeInput({ margin: 0 }),
      NOW
    );
    expect(result.breakdown.taxEfficiency).toBe(10);
  });

  it('taxEfficiency: scores 10 when tax is null', () => {
    const result = calculateFlipQualityScore(
      makeInput({ tax: null }),
      NOW
    );
    expect(result.breakdown.taxEfficiency).toBe(10);
  });

  it('taxEfficiency: scores 10 when tax consumes 70%+ of margin', () => {
    const result = calculateFlipQualityScore(
      makeInput({ margin: 100, tax: 80 }),
      NOW
    );
    expect(result.breakdown.taxEfficiency).toBe(10);
  });

  // -- Flags --

  it('flags: detects stale-prices when staleness score is low', () => {
    const result = calculateFlipQualityScore(
      makeInput({ buyPriceTime: null, sellPriceTime: null }),
      NOW
    );
    expect(result.flags).toContain('stale-prices');
  });

  it('flags: detects low-volume when liquidity score is low', () => {
    const result = calculateFlipQualityScore(
      makeInput({ volume1h: 5, volume5m: 5 }),
      NOW
    );
    expect(result.flags).toContain('low-volume');
  });

  it('flags: detects high-tax-impact when tax efficiency is low', () => {
    const result = calculateFlipQualityScore(
      makeInput({ margin: 100, tax: 80 }),
      NOW
    );
    expect(result.flags).toContain('high-tax-impact');
  });

  it('flags: detects thin-market for low volume + poor adequacy', () => {
    const result = calculateFlipQualityScore(
      makeInput({ volume1h: 5, volume5m: 5, buyLimit: 1000 }),
      NOW
    );
    expect(result.flags).toContain('thin-market');
  });

  it('flags: no flags for a healthy item', () => {
    const input = makeInput({
      volume1h: 2000,
      margin: 100,
      tax: 5,
      buyLimit: 100,
    });
    const result = calculateFlipQualityScore(input, NOW);
    expect(result.flags).toHaveLength(0);
  });

  // -- Composite score is weighted sum --

  it('composite score matches weighted sum of sub-scores', () => {
    const result = calculateFlipQualityScore(makeInput(), NOW);
    const { breakdown } = result;

    const expected = Math.round(
      breakdown.liquidity * 0.25 +
        breakdown.staleness * 0.2 +
        breakdown.marginStability * 0.2 +
        breakdown.volumeAdequacy * 0.15 +
        breakdown.buyPressure * 0.1 +
        breakdown.taxEfficiency * 0.1
    );

    expect(result.score).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// meetsMinimumGrade
// ---------------------------------------------------------------------------

describe('meetsMinimumGrade', () => {
  it('A meets any minimum grade', () => {
    expect(meetsMinimumGrade('A', 'A')).toBe(true);
    expect(meetsMinimumGrade('A', 'B')).toBe(true);
    expect(meetsMinimumGrade('A', 'F')).toBe(true);
  });

  it('F only meets F minimum', () => {
    expect(meetsMinimumGrade('F', 'F')).toBe(true);
    expect(meetsMinimumGrade('F', 'D')).toBe(false);
    expect(meetsMinimumGrade('F', 'A')).toBe(false);
  });

  it('B meets B, C, D, F but not A', () => {
    expect(meetsMinimumGrade('B', 'A')).toBe(false);
    expect(meetsMinimumGrade('B', 'B')).toBe(true);
    expect(meetsMinimumGrade('B', 'C')).toBe(true);
    expect(meetsMinimumGrade('B', 'D')).toBe(true);
    expect(meetsMinimumGrade('B', 'F')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// GRADE_ORDER
// ---------------------------------------------------------------------------

describe('GRADE_ORDER', () => {
  it('has correct ordering (A < B < C < D < F)', () => {
    const grades: FlipQualityGrade[] = ['A', 'B', 'C', 'D', 'F'];
    for (let i = 0; i < grades.length - 1; i++) {
      expect(GRADE_ORDER[grades[i]!]).toBeLessThan(
        GRADE_ORDER[grades[i + 1]!]
      );
    }
  });
});
