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
function makeInput(
  overrides: Partial<FlipScoringInput> = {}
): FlipScoringInput {
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

  it('breakdown contains all nine sub-scores between 0-100', () => {
    const { breakdown } = calculateFlipQualityScore(makeInput(), NOW);

    for (const key of [
      'liquidity',
      'staleness',
      'marginStability',
      'volumeAdequacy',
      'buyPressure',
      'taxEfficiency',
      'volumeAnomaly',
      'priceConsistency',
      'historicalReliability',
    ] as const) {
      expect(breakdown[key]).toBeGreaterThanOrEqual(0);
      expect(breakdown[key]).toBeLessThanOrEqual(100);
    }
  });

  // -- Grade mapping --

  it('grades a high-quality item as A or B', () => {
    const input = makeInput({
      volume1h: 2000,
      volume5m: 170,
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
    // 200 volume → ≥200, <500 → score 70
    expect(result.breakdown.liquidity).toBe(70);
  });

  it('liquidity: applies burst penalty when vol1h >= 100 but vol5m <= 2', () => {
    const result = calculateFlipQualityScore(
      makeInput({ volume1h: 500, volume5m: 1 }),
      NOW
    );
    // Base score for 500 (>=500, <1000) is 85, minus 20 burst penalty = 65
    expect(result.breakdown.liquidity).toBe(65);
  });

  it('liquidity: no burst penalty when vol5m is healthy', () => {
    const result = calculateFlipQualityScore(
      makeInput({ volume1h: 500, volume5m: 50 }),
      NOW
    );
    // 500 (>=500, <1000) → score 85, vol5m=50 > 2 so no burst penalty
    expect(result.breakdown.liquidity).toBe(85);
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
    const result = calculateFlipQualityScore(makeInput({ margin: null }), NOW);
    expect(result.breakdown.marginStability).toBe(30);
  });

  it('marginStability: applies cross-timeframe penalty when 5m and 1h margins diverge', () => {
    // 5m margin = 200, 1h margin = 100 → 100% divergence → -15 penalty
    const result = calculateFlipQualityScore(
      makeInput({
        margin: 150,
        avgHighPrice5m: 1100,
        avgLowPrice5m: 900,
        avgHighPrice1h: 1050,
        avgLowPrice1h: 950,
      }),
      NOW
    );
    // Without penalty: avg margin = (200+100)/2=150, divergence=0% → 100
    // Cross-timeframe: |200-100|/100 = 100% > 50% → -15
    expect(result.breakdown.marginStability).toBe(85);
  });

  it('marginStability: applies smaller penalty for moderate cross-timeframe divergence', () => {
    // 5m margin = 140, 1h margin = 100 → 40% divergence → -10 penalty
    const result = calculateFlipQualityScore(
      makeInput({
        margin: 120,
        avgHighPrice5m: 1070,
        avgLowPrice5m: 930,
        avgHighPrice1h: 1050,
        avgLowPrice1h: 950,
      }),
      NOW
    );
    // avg margin = (140+100)/2=120, live=120, divergence=0% → 100
    // Cross-timeframe: |140-100|/100 = 40% > 30% → -10
    expect(result.breakdown.marginStability).toBe(90);
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
    const result = calculateFlipQualityScore(makeInput({ margin: 0 }), NOW);
    expect(result.breakdown.taxEfficiency).toBe(10);
  });

  it('taxEfficiency: scores 10 when tax is null', () => {
    const result = calculateFlipQualityScore(makeInput({ tax: null }), NOW);
    expect(result.breakdown.taxEfficiency).toBe(10);
  });

  it('taxEfficiency: scores 10 when tax consumes 70%+ of margin', () => {
    const result = calculateFlipQualityScore(
      makeInput({ margin: 100, tax: 80 }),
      NOW
    );
    expect(result.breakdown.taxEfficiency).toBe(10);
  });

  // -- Volume Anomaly sub-score --

  it('volumeAnomaly: scores 100 when 5m/1h rate ratio is normal (0.5-2.0)', () => {
    // volume1h=600, expected5m = 600/12 = 50, volume5m=50, ratio=1.0
    const result = calculateFlipQualityScore(
      makeInput({ volume1h: 600, volume5m: 50 }),
      NOW
    );
    expect(result.breakdown.volumeAnomaly).toBe(100);
  });

  it('volumeAnomaly: scores 50 when no volume data available', () => {
    const result = calculateFlipQualityScore(
      makeInput({ volume1h: null, volume5m: null }),
      NOW
    );
    expect(result.breakdown.volumeAnomaly).toBe(50);
  });

  it('volumeAnomaly: scores 100 when 5m is quiet but 1h is decent (normal decay)', () => {
    const result = calculateFlipQualityScore(
      makeInput({ volume1h: 500, volume5m: 0 }),
      NOW
    );
    expect(result.breakdown.volumeAnomaly).toBe(100);
  });

  it('volumeAnomaly: scores 15 for classic manipulation pattern (high 5m, low 1h)', () => {
    // High 5m volume but very low 1h → just started pumping
    const result = calculateFlipQualityScore(
      makeInput({ volume5m: 30, volume1h: 10 }),
      NOW
    );
    expect(result.breakdown.volumeAnomaly).toBe(15);
  });

  it('volumeAnomaly: scores 75 for slightly elevated 5m rate', () => {
    // volume1h=120, expected5m = 120/12 = 10, volume5m=25, ratio=2.5
    const result = calculateFlipQualityScore(
      makeInput({ volume1h: 120, volume5m: 25 }),
      NOW
    );
    expect(result.breakdown.volumeAnomaly).toBe(75);
  });

  it('volumeAnomaly: scores 50 for suspicious spike (3-5x rate)', () => {
    // volume1h=120, expected5m=10, volume5m=40, ratio=4.0
    const result = calculateFlipQualityScore(
      makeInput({ volume1h: 120, volume5m: 40 }),
      NOW
    );
    expect(result.breakdown.volumeAnomaly).toBe(50);
  });

  it('volumeAnomaly: scores 25 for likely manipulation (5-10x rate)', () => {
    // volume1h=120, expected5m=10, volume5m=70, ratio=7.0
    const result = calculateFlipQualityScore(
      makeInput({ volume1h: 120, volume5m: 70 }),
      NOW
    );
    expect(result.breakdown.volumeAnomaly).toBe(25);
  });

  it('volumeAnomaly: scores 10 for extreme anomaly (>10x rate)', () => {
    // volume1h=120, expected5m=10, volume5m=120, ratio=12.0
    const result = calculateFlipQualityScore(
      makeInput({ volume1h: 120, volume5m: 120 }),
      NOW
    );
    expect(result.breakdown.volumeAnomaly).toBe(10);
  });

  // -- Price Consistency sub-score --

  it('priceConsistency: scores 100 when live prices match 1h averages (<3%)', () => {
    const result = calculateFlipQualityScore(
      makeInput({
        buyPrice: 1000,
        sellPrice: 900,
        avgHighPrice1h: 1005,
        avgLowPrice1h: 905,
      }),
      NOW
    );
    expect(result.breakdown.priceConsistency).toBe(100);
  });

  it('priceConsistency: scores 40 when no live prices available', () => {
    const result = calculateFlipQualityScore(
      makeInput({ buyPrice: null, sellPrice: null }),
      NOW
    );
    expect(result.breakdown.priceConsistency).toBe(40);
  });

  it('priceConsistency: scores 40 when no 1h averages available', () => {
    const result = calculateFlipQualityScore(
      makeInput({ avgHighPrice1h: null, avgLowPrice1h: null }),
      NOW
    );
    expect(result.breakdown.priceConsistency).toBe(40);
  });

  it('priceConsistency: scores low for large price divergence (>=25%)', () => {
    const result = calculateFlipQualityScore(
      makeInput({
        buyPrice: 1300,
        sellPrice: 900,
        avgHighPrice1h: 1000,
        avgLowPrice1h: 900,
      }),
      NOW
    );
    // buyDivergence = |1300-1000|/1000 = 30% → >=25% → score 15
    expect(result.breakdown.priceConsistency).toBe(15);
  });

  it('priceConsistency: applies cross-timeframe penalty when 5m/1h averages diverge', () => {
    const result = calculateFlipQualityScore(
      makeInput({
        buyPrice: 1000,
        sellPrice: 900,
        avgHighPrice5m: 1300,
        avgLowPrice5m: 900,
        avgHighPrice1h: 1000,
        avgLowPrice1h: 900,
      }),
      NOW
    );
    // Live vs 1h: buyDiv=0%, sellDiv=0% → base score 100
    // Cross-check: |1300-1000|/1000=30% > 25% → -15 penalty
    expect(result.breakdown.priceConsistency).toBe(85);
  });

  // -- Historical Reliability sub-score --

  it('historicalReliability: scores 50 (neutral) when no historical context', () => {
    const result = calculateFlipQualityScore(makeInput(), NOW);
    expect(result.breakdown.historicalReliability).toBe(50);
  });

  it('historicalReliability: scores 50 when dataPoints < 3', () => {
    const result = calculateFlipQualityScore(
      makeInput({
        historicalContext: {
          avgPrice30d: 1000,
          avgVolume30d: 500,
          volatility30d: 5,
          dataPoints: 2,
        },
      }),
      NOW
    );
    expect(result.breakdown.historicalReliability).toBe(50);
  });

  it('historicalReliability: scores high with good historical alignment', () => {
    const result = calculateFlipQualityScore(
      makeInput({
        buyPrice: 1000,
        volume1h: 500,
        historicalContext: {
          avgPrice30d: 1000, // price matches exactly
          avgVolume30d: 500, // volume matches exactly
          volatility30d: 3, // very stable
          dataPoints: 30, // full month of data
        },
      }),
      NOW
    );
    // base 50 + 15 (30+ dataPoints) + 15 (price <5%) + 10 (volume 0.5-2.0) + 10 (volatility <5%) = 100
    expect(result.breakdown.historicalReliability).toBe(100);
  });

  it('historicalReliability: penalizes extreme price divergence from 30d avg', () => {
    const result = calculateFlipQualityScore(
      makeInput({
        buyPrice: 1500, // 50% above 30d avg
        historicalContext: {
          avgPrice30d: 1000,
          avgVolume30d: null,
          volatility30d: null,
          dataPoints: 30,
        },
      }),
      NOW
    );
    // base 50 + 15 (dataPoints) - 15 (price >40%) = 50
    expect(result.breakdown.historicalReliability).toBe(50);
  });

  it('historicalReliability: penalizes high volatility', () => {
    const result = calculateFlipQualityScore(
      makeInput({
        buyPrice: 1000,
        historicalContext: {
          avgPrice30d: 1000,
          avgVolume30d: null,
          volatility30d: 35, // very volatile
          dataPoints: 14,
        },
      }),
      NOW
    );
    // base 50 + 10 (14+ dataPoints) + 15 (price <5%) - 10 (volatility >30%) = 65
    expect(result.breakdown.historicalReliability).toBe(65);
  });

  it('historicalReliability: penalizes volume spike vs historical', () => {
    const result = calculateFlipQualityScore(
      makeInput({
        buyPrice: 1000,
        volume1h: 3000, // 6x historical average
        historicalContext: {
          avgPrice30d: 1000,
          avgVolume30d: 500,
          volatility30d: 5,
          dataPoints: 30,
        },
      }),
      NOW
    );
    // base 50 + 15 (dataPoints) + 15 (price <5%) - 10 (volume >5x) + 5 (volatility <10%) = 75
    expect(result.breakdown.historicalReliability).toBe(75);
  });

  // -- Extended multi-timeframe historicalReliability --

  it('historicalReliability: bonus for price near 365d average', () => {
    const result = calculateFlipQualityScore(
      makeInput({
        buyPrice: 1000,
        volume1h: 500,
        historicalContext: {
          avgPrice30d: 1000,
          avgVolume30d: 500,
          volatility30d: 3,
          dataPoints: 30,
          avgPrice365d: 1010, // very close to current price
        },
      }),
      NOW
    );
    // base 50 + 15 (data) + 15 (price30d <5%) + 10 (volume) + 10 (vol <5%) + 5 (365d <10%) = 105 → capped 100
    expect(result.breakdown.historicalReliability).toBe(100);
  });

  it('historicalReliability: penalty for price far from 365d average', () => {
    const result = calculateFlipQualityScore(
      makeInput({
        buyPrice: 2000,
        volume1h: 500,
        historicalContext: {
          avgPrice30d: 2000,
          avgVolume30d: 500,
          volatility30d: 3,
          dataPoints: 30,
          avgPrice365d: 1000, // 100% above yearly average
        },
      }),
      NOW
    );
    // base 50 + 15 + 15 + 10 + 10 - 5 (365d >50%) = 95
    expect(result.breakdown.historicalReliability).toBe(95);
  });

  it('historicalReliability: RSI neutral adds bonus', () => {
    const result = calculateFlipQualityScore(
      makeInput({
        buyPrice: 1000,
        volume1h: 500,
        historicalContext: {
          avgPrice30d: 1000,
          avgVolume30d: 500,
          volatility30d: 3,
          dataPoints: 30,
          rsi14d: 50, // perfectly neutral
        },
      }),
      NOW
    );
    // base 50 + 15 + 15 + 10 + 10 + 3 (RSI neutral) = 103 → capped 100
    expect(result.breakdown.historicalReliability).toBe(100);
  });

  it('historicalReliability: RSI overbought penalty', () => {
    const result = calculateFlipQualityScore(
      makeInput({
        buyPrice: 1000,
        historicalContext: {
          avgPrice30d: 1000,
          avgVolume30d: null,
          volatility30d: null,
          dataPoints: 30,
          rsi14d: 85, // overbought
        },
      }),
      NOW
    );
    // base 50 + 15 (data) + 15 (price <5%) - 5 (RSI >80) = 75
    expect(result.breakdown.historicalReliability).toBe(75);
  });

  it('historicalReliability: Bollinger band breach penalty', () => {
    const result = calculateFlipQualityScore(
      makeInput({
        buyPrice: 1000,
        historicalContext: {
          avgPrice30d: 1000,
          avgVolume30d: null,
          volatility30d: null,
          dataPoints: 30,
          belowBollingerLower: true,
        },
      }),
      NOW
    );
    // base 50 + 15 + 15 - 5 (Bollinger breach) = 75
    expect(result.breakdown.historicalReliability).toBe(75);
  });

  it('historicalReliability: MACD bullish signal bonus', () => {
    const result = calculateFlipQualityScore(
      makeInput({
        buyPrice: 1000,
        historicalContext: {
          avgPrice30d: 1000,
          avgVolume30d: null,
          volatility30d: null,
          dataPoints: 30,
          macdSignal: 1,
        },
      }),
      NOW
    );
    // base 50 + 15 + 15 + 3 (MACD bullish) = 83
    expect(result.breakdown.historicalReliability).toBe(83);
  });

  it('historicalReliability: MACD bearish signal penalty', () => {
    const result = calculateFlipQualityScore(
      makeInput({
        buyPrice: 1000,
        historicalContext: {
          avgPrice30d: 1000,
          avgVolume30d: null,
          volatility30d: null,
          dataPoints: 30,
          macdSignal: -1,
        },
      }),
      NOW
    );
    // base 50 + 15 + 15 - 3 (MACD bearish) = 77
    expect(result.breakdown.historicalReliability).toBe(77);
  });

  it('flags: detects historically-unusual when historicalReliability is very low', () => {
    const result = calculateFlipQualityScore(
      makeInput({
        buyPrice: 2000, // 100% above 30d avg
        volume1h: 5000, // 10x historical volume
        historicalContext: {
          avgPrice30d: 1000,
          avgVolume30d: 500,
          volatility30d: 35,
          dataPoints: 7,
        },
      }),
      NOW
    );
    // base 50 + 5 (7+ dataPoints) - 15 (price >40%) - 10 (volume >5x) - 10 (volatility >30%) = 20
    expect(result.breakdown.historicalReliability).toBe(20);
    expect(result.flags).toContain('historically-unusual');
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

  it('flags: detects unprofitable-after-tax when margin does not cover tax', () => {
    const result = calculateFlipQualityScore(
      makeInput({ margin: 10, tax: 20 }),
      NOW
    );
    expect(result.flags).toContain('unprofitable-after-tax');
  });

  it('flags: does not flag unprofitable-after-tax when margin covers tax', () => {
    const result = calculateFlipQualityScore(
      makeInput({ margin: 100, tax: 10 }),
      NOW
    );
    expect(result.flags).not.toContain('unprofitable-after-tax');
  });

  it('flags: detects near-alch-floor when sell price is within 5% of alch floor', () => {
    const result = calculateFlipQualityScore(
      makeInput({ sellPrice: 950, alchFloor: 920 }),
      NOW
    );
    expect(result.flags).toContain('near-alch-floor');
  });

  it('flags: does not flag near-alch-floor when price is well above', () => {
    const result = calculateFlipQualityScore(
      makeInput({ sellPrice: 900, alchFloor: 500 }),
      NOW
    );
    expect(result.flags).not.toContain('near-alch-floor');
  });

  it('flags: does not flag near-alch-floor when alchFloor is null', () => {
    const result = calculateFlipQualityScore(
      makeInput({ sellPrice: 900 }),
      NOW
    );
    expect(result.flags).not.toContain('near-alch-floor');
  });

  it('flags: detects thin-market for low volume + poor adequacy', () => {
    const result = calculateFlipQualityScore(
      makeInput({ volume1h: 5, volume5m: 5, buyLimit: 1000 }),
      NOW
    );
    expect(result.flags).toContain('thin-market');
  });

  it('flags: detects volume-spike when volume anomaly score is low', () => {
    const result = calculateFlipQualityScore(
      makeInput({ volume5m: 30, volume1h: 10 }),
      NOW
    );
    expect(result.flags).toContain('volume-spike');
  });

  it('flags: detects price-divergence when price consistency is low', () => {
    const result = calculateFlipQualityScore(
      makeInput({
        buyPrice: 1500,
        sellPrice: 900,
        avgHighPrice1h: 1000,
        avgLowPrice1h: 900,
      }),
      NOW
    );
    expect(result.flags).toContain('price-divergence');
  });

  it('flags: detects potential-manipulation when volume spike + price divergence', () => {
    const result = calculateFlipQualityScore(
      makeInput({
        volume5m: 30,
        volume1h: 10,
        buyPrice: 1500,
        sellPrice: 900,
        avgHighPrice1h: 1000,
        avgLowPrice1h: 900,
      }),
      NOW
    );
    expect(result.flags).toContain('potential-manipulation');
  });

  it('flags: detects potential-manipulation when volume spike + thin market', () => {
    const result = calculateFlipQualityScore(
      makeInput({
        volume5m: 30,
        volume1h: 10,
        buyLimit: 1000,
      }),
      NOW
    );
    expect(result.flags).toContain('potential-manipulation');
  });

  it('flags: no flags for a healthy item', () => {
    const input = makeInput({
      volume1h: 2000,
      volume5m: 170,
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
      breakdown.liquidity * 0.12 +
        breakdown.staleness * 0.08 +
        breakdown.marginStability * 0.12 +
        breakdown.volumeAdequacy * 0.08 +
        breakdown.buyPressure * 0.08 +
        breakdown.taxEfficiency * 0.08 +
        breakdown.volumeAnomaly * 0.14 +
        breakdown.priceConsistency * 0.14 +
        breakdown.historicalReliability * 0.16
    );

    expect(result.score).toBe(expected);
  });

  // -- Manipulation scenario tests --

  it('penalizes items with random low-volume spikes (manipulation scenario)', () => {
    // Item that normally trades very low but had a random spike
    const manipulated = makeInput({
      volume1h: 15,
      volume5m: 20, // More 5m volume than 1h total → obvious spike
      margin: 500,
      avgHighPrice5m: 1200,
      avgLowPrice5m: 700,
      avgHighPrice1h: 1000,
      avgLowPrice1h: 900,
      buyLimit: 500,
    });
    const result = calculateFlipQualityScore(manipulated, NOW);

    // Should be rated poorly due to volume spike + price divergence
    expect(result.score).toBeLessThan(55);
    expect(result.flags).toContain('volume-spike');
  });

  it('rates a genuinely liquid item well even with high volume', () => {
    const genuine = makeInput({
      volume1h: 5000,
      volume5m: 400, // Proportional to 1h rate
      margin: 50,
      tax: 5,
      buyLimit: 200,
      avgHighPrice5m: 1005,
      avgLowPrice5m: 905,
      avgHighPrice1h: 1003,
      avgLowPrice1h: 903,
    });
    const result = calculateFlipQualityScore(genuine, NOW);

    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.flags).not.toContain('volume-spike');
    expect(result.flags).not.toContain('potential-manipulation');
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
      expect(GRADE_ORDER[grades[i]!]).toBeLessThan(GRADE_ORDER[grades[i + 1]!]);
    }
  });
});
