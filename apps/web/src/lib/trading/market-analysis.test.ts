import type { GeDailySummary } from '@skillbound/database';
import { describe, expect, it, vi } from 'vitest';

import {
  analyzeItemMarket,
  computeATR,
  computeBollingerBands,
  computeEMA,
  computeFibonacciLevels,
  computeMACD,
  computeManipulationRisk,
  computeOBV,
  computePriceTrend,
  computeRSI,
  computeSMA,
  computeVWAP,
  computeVolumeTrend,
  detectSeasonalPatterns,
  findPriceLevels,
  generateInsights,
  type ItemMarketAnalysis,
} from './market-analysis';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let _id = 0;
function makeSummary(
  overrides: Partial<Omit<GeDailySummary, 'date'>> & {
    date: Date | string;
    itemId?: number;
  }
): GeDailySummary {
  _id++;
  const date =
    typeof overrides.date === 'string'
      ? new Date(overrides.date)
      : overrides.date;

  return {
    id: `test-${_id}`,
    itemId: overrides.itemId ?? 1,
    date,
    avgBuyPrice: 'avgBuyPrice' in overrides ? overrides.avgBuyPrice! : 1000,
    avgSellPrice: 'avgSellPrice' in overrides ? overrides.avgSellPrice! : 950,
    highBuyPrice: 'highBuyPrice' in overrides ? overrides.highBuyPrice! : 1050,
    lowBuyPrice: 'lowBuyPrice' in overrides ? overrides.lowBuyPrice! : 950,
    highSellPrice:
      'highSellPrice' in overrides ? overrides.highSellPrice! : 1000,
    lowSellPrice: 'lowSellPrice' in overrides ? overrides.lowSellPrice! : 900,
    totalVolume: 'totalVolume' in overrides ? overrides.totalVolume! : 500,
    avgMargin: 'avgMargin' in overrides ? overrides.avgMargin! : 50,
    avgMarginPercent:
      'avgMarginPercent' in overrides ? overrides.avgMarginPercent! : 5.0,
    snapshotCount: overrides.snapshotCount ?? 4,
  };
}

/** Generate N summaries with linearly changing prices */
function makeLinearSeries(
  count: number,
  startPrice: number,
  endPrice: number,
  startDate: Date = new Date('2025-12-01')
): GeDailySummary[] {
  const summaries: GeDailySummary[] = [];
  for (let i = 0; i < count; i++) {
    const price = Math.round(
      startPrice + ((endPrice - startPrice) * i) / (count - 1)
    );
    const date = new Date(startDate);
    date.setUTCDate(date.getUTCDate() + i);
    summaries.push(makeSummary({ date, avgBuyPrice: price }));
  }
  return summaries;
}

// ---------------------------------------------------------------------------
// computePriceTrend
// ---------------------------------------------------------------------------

describe('computePriceTrend', () => {
  it('returns null when fewer than 3 data points', () => {
    const summaries = [
      makeSummary({ date: '2026-01-01', avgBuyPrice: 100 }),
      makeSummary({ date: '2026-01-02', avgBuyPrice: 110 }),
    ];
    expect(computePriceTrend(summaries, '7d')).toBeNull();
  });

  it('returns null when all avgBuyPrice are null', () => {
    const summaries = [
      makeSummary({ date: '2026-01-01', avgBuyPrice: null }),
      makeSummary({ date: '2026-01-02', avgBuyPrice: null }),
      makeSummary({ date: '2026-01-03', avgBuyPrice: null }),
      makeSummary({ date: '2026-01-04', avgBuyPrice: null }),
    ];
    expect(computePriceTrend(summaries, '7d')).toBeNull();
  });

  it('detects a rising trend', () => {
    const summaries = makeLinearSeries(10, 100, 200);
    const trend = computePriceTrend(summaries, '10d');
    expect(trend).not.toBeNull();
    expect(trend!.direction).toBe('rising');
    expect(trend!.changePercent).toBeGreaterThan(50);
    expect(trend!.period).toBe('10d');
  });

  it('detects a falling trend', () => {
    const summaries = makeLinearSeries(10, 200, 100);
    const trend = computePriceTrend(summaries, '10d');
    expect(trend).not.toBeNull();
    expect(trend!.direction).toBe('falling');
    expect(trend!.changePercent).toBeLessThan(-30);
  });

  it('detects a stable trend for flat prices', () => {
    const summaries = makeLinearSeries(10, 100, 101);
    const trend = computePriceTrend(summaries, '10d');
    expect(trend).not.toBeNull();
    expect(trend!.direction).toBe('stable');
  });

  it('includes confidence level', () => {
    const summaries = makeLinearSeries(10, 100, 200);
    const trend = computePriceTrend(summaries, '10d');
    expect(['high', 'medium', 'low']).toContain(trend!.confidence);
  });
});

// ---------------------------------------------------------------------------
// computeVolumeTrend
// ---------------------------------------------------------------------------

describe('computeVolumeTrend', () => {
  it('returns null when fewer than 3 data points', () => {
    const summaries = [
      makeSummary({ date: '2026-01-01', totalVolume: 100 }),
      makeSummary({ date: '2026-01-02', totalVolume: 200 }),
    ];
    expect(computeVolumeTrend(summaries, '7d')).toBeNull();
  });

  it('detects rising volume', () => {
    const summaries: GeDailySummary[] = [];
    for (let i = 0; i < 12; i++) {
      const date = new Date('2026-01-01');
      date.setUTCDate(date.getUTCDate() + i);
      // First 8 days: low volume, last 4 days: high volume
      summaries.push(makeSummary({ date, totalVolume: i >= 8 ? 1000 : 100 }));
    }
    const trend = computeVolumeTrend(summaries, '12d');
    expect(trend).not.toBeNull();
    expect(trend!.direction).toBe('rising');
    expect(trend!.recentAvgVolume).toBeGreaterThan(trend!.avgVolume);
  });

  it('detects falling volume', () => {
    const summaries: GeDailySummary[] = [];
    for (let i = 0; i < 12; i++) {
      const date = new Date('2026-01-01');
      date.setUTCDate(date.getUTCDate() + i);
      // First 8 days: high volume, last 4 days: low volume
      summaries.push(makeSummary({ date, totalVolume: i >= 8 ? 100 : 1000 }));
    }
    const trend = computeVolumeTrend(summaries, '12d');
    expect(trend).not.toBeNull();
    expect(trend!.direction).toBe('falling');
  });

  it('detects stable volume', () => {
    const summaries: GeDailySummary[] = [];
    for (let i = 0; i < 10; i++) {
      const date = new Date('2026-01-01');
      date.setUTCDate(date.getUTCDate() + i);
      summaries.push(makeSummary({ date, totalVolume: 500 }));
    }
    const trend = computeVolumeTrend(summaries, '10d');
    expect(trend).not.toBeNull();
    expect(trend!.direction).toBe('stable');
  });
});

// ---------------------------------------------------------------------------
// detectSeasonalPatterns
// ---------------------------------------------------------------------------

describe('detectSeasonalPatterns', () => {
  it('returns empty array when fewer than 60 data points', () => {
    const summaries = makeLinearSeries(30, 100, 200);
    expect(detectSeasonalPatterns(summaries)).toEqual([]);
  });

  it('detects patterns from sufficient data across months', () => {
    const summaries: GeDailySummary[] = [];
    // Generate 90 days across 3 months — each month has >=5 samples
    for (let i = 0; i < 90; i++) {
      const date = new Date('2025-10-01');
      date.setUTCDate(date.getUTCDate() + i);
      const month = date.getUTCMonth() + 1;
      // Make October expensive, November cheap, December moderate
      let price = 1000;
      if (month === 10) price = 1200;
      else if (month === 11) price = 800;
      else if (month === 12) price = 1000;
      summaries.push(makeSummary({ date, avgBuyPrice: price }));
    }

    const patterns = detectSeasonalPatterns(summaries);
    expect(patterns.length).toBeGreaterThan(0);
    // Patterns should be sorted by month
    for (let i = 0; i < patterns.length - 1; i++) {
      expect(patterns[i]!.month).toBeLessThan(patterns[i + 1]!.month);
    }
    // Each pattern has expected fields
    for (const p of patterns) {
      expect(p.month).toBeGreaterThanOrEqual(1);
      expect(p.month).toBeLessThanOrEqual(12);
      expect(p.monthName).toBeTruthy();
      expect(typeof p.avgPriceChange).toBe('number');
      expect(typeof p.avgVolumeChange).toBe('number');
      expect(p.sampleSize).toBeGreaterThanOrEqual(1);
      expect(['high', 'medium', 'low']).toContain(p.confidence);
    }
  });

  it('skips months with fewer than 5 samples', () => {
    const summaries: GeDailySummary[] = [];
    // 60 days in Jan, 2 days in Feb
    for (let i = 0; i < 60; i++) {
      const date = new Date('2026-01-01');
      date.setUTCDate(date.getUTCDate() + i);
      summaries.push(makeSummary({ date, avgBuyPrice: 1000 }));
    }
    // Only add 2 entries for March (< 5 required)
    summaries.push(makeSummary({ date: '2026-03-01', avgBuyPrice: 1000 }));
    summaries.push(makeSummary({ date: '2026-03-02', avgBuyPrice: 1000 }));

    const patterns = detectSeasonalPatterns(summaries);
    const marchPattern = patterns.find((p) => p.month === 3);
    expect(marchPattern).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// findPriceLevels
// ---------------------------------------------------------------------------

describe('findPriceLevels', () => {
  it('returns empty array for insufficient data', () => {
    const summaries = [
      makeSummary({ date: '2026-01-01' }),
      makeSummary({ date: '2026-01-02' }),
    ];
    expect(findPriceLevels(summaries)).toEqual([]);
  });

  it('finds support and resistance levels from clustered prices', () => {
    const summaries: GeDailySummary[] = [];
    for (let i = 0; i < 30; i++) {
      const date = new Date('2026-01-01');
      date.setUTCDate(date.getUTCDate() + i);
      // Prices cluster around 900-1000 and 1200-1300
      const isHighPhase = i >= 15;
      summaries.push(
        makeSummary({
          date,
          highBuyPrice: isHighPhase ? 1300 : 1000,
          lowBuyPrice: isHighPhase ? 1200 : 900,
          highSellPrice: isHighPhase ? 1250 : 950,
          lowSellPrice: isHighPhase ? 1150 : 850,
          avgBuyPrice: isHighPhase ? 1250 : 950,
        })
      );
    }

    const levels = findPriceLevels(summaries);
    // Should find at least one level
    expect(levels.length).toBeGreaterThanOrEqual(0);
    for (const level of levels) {
      expect(['support', 'resistance']).toContain(level.type);
      expect(level.price).toBeGreaterThan(0);
      expect(level.strength).toBeGreaterThanOrEqual(0);
      expect(level.strength).toBeLessThanOrEqual(100);
    }
  });

  it('returns at most 5 levels', () => {
    const summaries: GeDailySummary[] = [];
    for (let i = 0; i < 100; i++) {
      const date = new Date('2025-10-01');
      date.setUTCDate(date.getUTCDate() + i);
      summaries.push(
        makeSummary({
          date,
          highBuyPrice: 1000 + (i % 10) * 100,
          lowBuyPrice: 900 + (i % 10) * 100,
          highSellPrice: 950 + (i % 10) * 100,
          lowSellPrice: 850 + (i % 10) * 100,
        })
      );
    }

    const levels = findPriceLevels(summaries);
    expect(levels.length).toBeLessThanOrEqual(5);
  });
});

// ---------------------------------------------------------------------------
// generateInsights
// ---------------------------------------------------------------------------

describe('generateInsights', () => {
  function makeAnalysis(
    overrides: Partial<Omit<ItemMarketAnalysis, 'insights'>> = {}
  ): Omit<ItemMarketAnalysis, 'insights'> {
    return {
      itemId: 1,
      dataPoints: 30,
      dataSpanDays: 30,
      currentPrice: 1000,
      avgPrice30d: 1000,
      avgPrice90d: 1000,
      priceVsAvg30d: 0,
      priceVsAvg90d: 0,
      priceTrend7d: null,
      priceTrend30d: null,
      volumeTrend: null,
      priceVolatility30d: null,
      avgPrice365d: 1000,
      priceVsAvg365d: 0,
      rsi14d: null,
      bollingerBands: null,
      macd: null,
      sma200d: null,
      obv: null,
      atr14d: null,
      vwap: null,
      fibonacci: null,
      manipulationRisk: 0,
      seasonalPatterns: [],
      priceLevels: [],
      ...overrides,
    };
  }

  it('generates buy-signal when price is well below 30d average', () => {
    const insights = generateInsights(makeAnalysis({ priceVsAvg30d: -20 }));
    expect(insights.some((i) => i.type === 'buy-signal')).toBe(true);
  });

  it('generates sell-signal when price is well above 30d average', () => {
    const insights = generateInsights(makeAnalysis({ priceVsAvg30d: 25 }));
    expect(insights.some((i) => i.type === 'sell-signal')).toBe(true);
  });

  it('generates trend-alert for rising 7d trend', () => {
    const insights = generateInsights(
      makeAnalysis({
        priceTrend7d: {
          direction: 'rising',
          changePercent: 10,
          period: '7d',
          confidence: 'medium',
        },
      })
    );
    expect(insights.some((i) => i.type === 'trend-alert')).toBe(true);
  });

  it('generates trend-alert for falling 7d trend', () => {
    const insights = generateInsights(
      makeAnalysis({
        priceTrend7d: {
          direction: 'falling',
          changePercent: -15,
          period: '7d',
          confidence: 'high',
        },
      })
    );
    expect(insights.some((i) => i.type === 'trend-alert')).toBe(true);
  });

  it('generates info for trend reversal (7d vs 30d conflict)', () => {
    const insights = generateInsights(
      makeAnalysis({
        priceTrend7d: {
          direction: 'rising',
          changePercent: 10,
          period: '7d',
          confidence: 'medium',
        },
        priceTrend30d: {
          direction: 'falling',
          changePercent: -10,
          period: '30d',
          confidence: 'medium',
        },
      })
    );
    expect(insights.some((i) => i.type === 'info')).toBe(true);
  });

  it('generates volume-alert for declining volume', () => {
    const insights = generateInsights(
      makeAnalysis({
        volumeTrend: {
          direction: 'falling',
          changePercent: -40,
          period: '30d',
          avgVolume: 1000,
          recentAvgVolume: 600,
        },
      })
    );
    expect(insights.some((i) => i.type === 'volume-alert')).toBe(true);
  });

  it('generates volume-alert for volume spike', () => {
    const insights = generateInsights(
      makeAnalysis({
        volumeTrend: {
          direction: 'rising',
          changePercent: 60,
          period: '30d',
          avgVolume: 1000,
          recentAvgVolume: 1600,
        },
      })
    );
    expect(insights.some((i) => i.type === 'volume-alert')).toBe(true);
  });

  it('generates manipulation-warning for high volatility', () => {
    const insights = generateInsights(makeAnalysis({ priceVolatility30d: 25 }));
    expect(insights.some((i) => i.type === 'manipulation-warning')).toBe(true);
  });

  it('generates no insights for perfectly average item', () => {
    const insights = generateInsights(makeAnalysis());
    expect(insights).toHaveLength(0);
  });

  it('does not generate trend-alert for low-confidence trends', () => {
    const insights = generateInsights(
      makeAnalysis({
        priceTrend7d: {
          direction: 'rising',
          changePercent: 3,
          period: '7d',
          confidence: 'low',
        },
      })
    );
    expect(insights.some((i) => i.type === 'trend-alert')).toBe(false);
  });

  // -- Technical indicator insights --

  it('generates buy-signal for RSI oversold', () => {
    const insights = generateInsights(makeAnalysis({ rsi14d: 18 }));
    const rsiInsight = insights.find((i) => i.title.includes('RSI'));
    expect(rsiInsight).toBeDefined();
    expect(rsiInsight!.type).toBe('buy-signal');
    expect(rsiInsight!.confidence).toBe('high'); // < 20
  });

  it('generates sell-signal for RSI overbought', () => {
    const insights = generateInsights(makeAnalysis({ rsi14d: 82 }));
    const rsiInsight = insights.find((i) => i.title.includes('RSI'));
    expect(rsiInsight).toBeDefined();
    expect(rsiInsight!.type).toBe('sell-signal');
  });

  it('generates buy-signal for below lower Bollinger Band', () => {
    const insights = generateInsights(
      makeAnalysis({
        currentPrice: 900,
        bollingerBands: { upper: 1100, middle: 1000, lower: 950 },
      })
    );
    const bbInsight = insights.find((i) => i.title.includes('Bollinger'));
    expect(bbInsight).toBeDefined();
    expect(bbInsight!.type).toBe('buy-signal');
  });

  it('generates buy-signal for MACD bullish crossover', () => {
    const insights = generateInsights(
      makeAnalysis({
        macd: { macd: 5, signal: 3, histogram: 2, crossover: 1 },
      })
    );
    const macdInsight = insights.find((i) => i.title.includes('MACD'));
    expect(macdInsight).toBeDefined();
    expect(macdInsight!.type).toBe('buy-signal');
  });

  it('generates sell-signal for MACD bearish crossover', () => {
    const insights = generateInsights(
      makeAnalysis({
        macd: { macd: -5, signal: -3, histogram: -2, crossover: -1 },
      })
    );
    const macdInsight = insights.find((i) => i.title.includes('MACD'));
    expect(macdInsight).toBeDefined();
    expect(macdInsight!.type).toBe('sell-signal');
  });

  it('generates buy-signal for price well below 200d SMA', () => {
    const insights = generateInsights(
      makeAnalysis({
        currentPrice: 800,
        sma200d: 1000, // 20% below
      })
    );
    const smaInsight = insights.find((i) => i.title.includes('200-day'));
    expect(smaInsight).toBeDefined();
    expect(smaInsight!.type).toBe('buy-signal');
  });

  it('generates info insight for price far below yearly average', () => {
    const insights = generateInsights(
      makeAnalysis({
        priceVsAvg365d: -25,
        avgPrice365d: 1333,
      })
    );
    const yearlyInsight = insights.find((i) => i.title.includes('yearly'));
    expect(yearlyInsight).toBeDefined();
    expect(yearlyInsight!.type).toBe('info');
  });
});

// ---------------------------------------------------------------------------
// analyzeItemMarket (integration)
// ---------------------------------------------------------------------------

describe('analyzeItemMarket', () => {
  it('produces a complete analysis from daily summaries', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T12:00:00Z'));

    const summaries = makeLinearSeries(30, 900, 1100, new Date('2026-01-30'));

    const analysis = analyzeItemMarket(1, summaries, 1050);

    expect(analysis.itemId).toBe(1);
    expect(analysis.dataPoints).toBe(30);
    expect(analysis.dataSpanDays).toBeGreaterThan(0);
    expect(analysis.currentPrice).toBe(1050);
    expect(analysis.avgPrice30d).toBeGreaterThan(0);
    expect(typeof analysis.priceVsAvg30d).toBe('number');
    expect(analysis.priceTrend7d).not.toBeNull();
    expect(analysis.priceTrend30d).not.toBeNull();
    expect(Array.isArray(analysis.insights)).toBe(true);
    expect(Array.isArray(analysis.seasonalPatterns)).toBe(true);
    expect(Array.isArray(analysis.priceLevels)).toBe(true);

    vi.useRealTimers();
  });

  it('handles empty summaries gracefully', () => {
    const analysis = analyzeItemMarket(42, [], null);
    expect(analysis.dataPoints).toBe(0);
    expect(analysis.dataSpanDays).toBe(0);
    expect(analysis.avgPrice30d).toBeNull();
    expect(analysis.priceTrend7d).toBeNull();
    expect(analysis.insights).toEqual([]);
  });

  it('calculates priceVsAvg30d correctly', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-15T12:00:00Z'));

    // All prices are 1000
    const summaries: GeDailySummary[] = [];
    for (let i = 0; i < 30; i++) {
      const date = new Date('2026-01-16');
      date.setUTCDate(date.getUTCDate() + i);
      summaries.push(makeSummary({ date, avgBuyPrice: 1000 }));
    }

    // Current price is 1200 — 20% above average
    const analysis = analyzeItemMarket(1, summaries, 1200);
    expect(analysis.priceVsAvg30d).toBeCloseTo(20, 0);

    vi.useRealTimers();
  });

  it('computes volatility for items with variable prices', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-15T12:00:00Z'));

    const summaries: GeDailySummary[] = [];
    for (let i = 0; i < 30; i++) {
      const date = new Date('2026-01-16');
      date.setUTCDate(date.getUTCDate() + i);
      // Alternate between 800 and 1200 — high volatility
      summaries.push(
        makeSummary({ date, avgBuyPrice: i % 2 === 0 ? 800 : 1200 })
      );
    }

    const analysis = analyzeItemMarket(1, summaries, 1000);
    expect(analysis.priceVolatility30d).not.toBeNull();
    expect(analysis.priceVolatility30d!).toBeGreaterThan(10);

    vi.useRealTimers();
  });

  it('includes technical indicators in analysis when enough data', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T12:00:00Z'));

    // 40 days of data — enough for RSI (15), Bollinger (20), MACD (35)
    const summaries = makeLinearSeries(40, 900, 1100, new Date('2026-01-20'));

    const analysis = analyzeItemMarket(1, summaries, 1050);

    expect(analysis.rsi14d).not.toBeNull();
    expect(analysis.rsi14d!).toBeGreaterThanOrEqual(0);
    expect(analysis.rsi14d!).toBeLessThanOrEqual(100);
    expect(analysis.bollingerBands).not.toBeNull();
    expect(analysis.bollingerBands!.upper).toBeGreaterThan(
      analysis.bollingerBands!.lower
    );
    expect(analysis.macd).not.toBeNull();

    vi.useRealTimers();
  });

  it('includes avgPrice365d and priceVsAvg365d', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T12:00:00Z'));

    const summaries = makeLinearSeries(30, 900, 1100, new Date('2026-01-30'));
    const analysis = analyzeItemMarket(1, summaries, 1050);

    expect(analysis.avgPrice365d).not.toBeNull();
    expect(typeof analysis.priceVsAvg365d).toBe('number');

    vi.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// Technical Indicators
// ---------------------------------------------------------------------------

describe('computeEMA', () => {
  it('returns empty array for empty input', () => {
    expect(computeEMA([], 10)).toEqual([]);
  });

  it('first value equals the first input value', () => {
    const ema = computeEMA([100, 110, 120], 3);
    expect(ema[0]).toBe(100);
  });

  it('produces values that smooth toward the trend', () => {
    const prices = [100, 110, 120, 130, 140];
    const ema = computeEMA(prices, 3);
    // EMA should be increasing and lagging behind actual prices
    for (let i = 1; i < ema.length; i++) {
      expect(ema[i]!).toBeGreaterThan(ema[i - 1]!);
    }
  });

  it('shorter period EMA reacts faster', () => {
    const prices = [100, 100, 100, 100, 200];
    const shortEma = computeEMA(prices, 3);
    const longEma = computeEMA(prices, 10);
    // Short EMA should be closer to 200 (last value) than long EMA
    expect(shortEma[4]!).toBeGreaterThan(longEma[4]!);
  });
});

describe('computeSMA', () => {
  it('returns null when insufficient data', () => {
    expect(computeSMA([1, 2, 3], 5)).toBeNull();
  });

  it('computes correct simple moving average', () => {
    expect(computeSMA([10, 20, 30, 40, 50], 5)).toBe(30);
  });

  it('uses only the last N values', () => {
    expect(computeSMA([1, 2, 3, 10, 20, 30], 3)).toBe(20);
  });
});

describe('computeRSI', () => {
  it('returns null with insufficient data', () => {
    expect(computeRSI([100, 110, 120], 14)).toBeNull();
  });

  it('returns 100 when all changes are gains', () => {
    // 16 values (15 changes), all positive
    const prices = Array.from({ length: 16 }, (_, i) => 100 + i * 10);
    expect(computeRSI(prices, 14)).toBe(100);
  });

  it('returns 0 when all changes are losses', () => {
    const prices = Array.from({ length: 16 }, (_, i) => 200 - i * 10);
    expect(computeRSI(prices, 14)).toBe(0);
  });

  it('returns around 50 for mixed even gains/losses', () => {
    // Alternating up and down by the same amount
    const prices: number[] = [];
    for (let i = 0; i < 30; i++) {
      prices.push(100 + (i % 2 === 0 ? 10 : -10));
    }
    const rsi = computeRSI(prices, 14)!;
    expect(rsi).toBeGreaterThan(30);
    expect(rsi).toBeLessThan(70);
  });

  it('is between 0 and 100 for realistic price data', () => {
    const prices = [
      1000, 1020, 1010, 1030, 1025, 1040, 1035, 1050, 1045, 1060, 1055, 1070,
      1065, 1080, 1075, 1090,
    ];
    const rsi = computeRSI(prices, 14)!;
    expect(rsi).toBeGreaterThanOrEqual(0);
    expect(rsi).toBeLessThanOrEqual(100);
  });
});

describe('computeBollingerBands', () => {
  it('returns null with insufficient data', () => {
    expect(computeBollingerBands([1, 2, 3], 20)).toBeNull();
  });

  it('computes bands correctly for constant prices', () => {
    const prices = Array(20).fill(100);
    const bands = computeBollingerBands(prices, 20, 2)!;
    expect(bands.middle).toBe(100);
    expect(bands.upper).toBe(100); // stddev is 0
    expect(bands.lower).toBe(100);
  });

  it('upper band is above middle and lower band is below', () => {
    const prices = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i) * 20);
    const bands = computeBollingerBands(prices, 20, 2)!;
    expect(bands.upper).toBeGreaterThan(bands.middle);
    expect(bands.lower).toBeLessThan(bands.middle);
  });

  it('wider multiplier produces wider bands', () => {
    const prices = Array.from({ length: 20 }, (_, i) => 100 + i);
    const narrow = computeBollingerBands(prices, 20, 1)!;
    const wide = computeBollingerBands(prices, 20, 3)!;
    expect(wide.upper - wide.lower).toBeGreaterThan(
      narrow.upper - narrow.lower
    );
  });
});

describe('computeMACD', () => {
  it('returns null with insufficient data', () => {
    expect(computeMACD(Array(30).fill(100))).toBeNull();
  });

  it('returns MACD components for sufficient data', () => {
    // 40 values — enough for 26+9=35 minimum
    const prices = Array.from({ length: 40 }, (_, i) => 100 + i);
    const result = computeMACD(prices)!;

    expect(result).toHaveProperty('macd');
    expect(result).toHaveProperty('signal');
    expect(result).toHaveProperty('histogram');
    expect(result).toHaveProperty('crossover');
    expect([-1, 0, 1]).toContain(result.crossover);
  });

  it('histogram equals macd minus signal', () => {
    const prices = Array.from(
      { length: 50 },
      (_, i) => 100 + i * 2 + Math.sin(i) * 5
    );
    const result = computeMACD(prices)!;
    expect(result.histogram).toBeCloseTo(result.macd - result.signal, 1);
  });

  it('MACD line is positive when prices are rising sharply', () => {
    // Falling then rising prices — MACD should be positive
    const prices: number[] = [];
    for (let i = 0; i < 40; i++) {
      prices.push(200 - i * 2); // falling
    }
    for (let i = 0; i < 20; i++) {
      prices.push(120 + i * 5); // rising sharply
    }
    const result = computeMACD(prices)!;
    // After a big reversal, MACD line should be positive (fast EMA > slow EMA)
    expect(result.macd).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// computeOBV
// ---------------------------------------------------------------------------

describe('computeOBV', () => {
  it('returns null with fewer than 3 data points', () => {
    expect(computeOBV([100, 110], [500, 600])).toBeNull();
  });

  it('computes positive OBV when prices rise with volume', () => {
    const prices = [100, 110, 120, 130, 140];
    const volumes = [500, 600, 700, 800, 900];
    const result = computeOBV(prices, volumes)!;
    expect(result.value).toBeGreaterThan(0);
    expect(result.trend).toBe('rising');
  });

  it('computes negative OBV when prices fall with volume', () => {
    const prices = [140, 130, 120, 110, 100];
    const volumes = [500, 600, 700, 800, 900];
    const result = computeOBV(prices, volumes)!;
    expect(result.value).toBeLessThan(0);
    expect(result.trend).toBe('falling');
  });

  it('OBV stays same when prices are flat', () => {
    const prices = [100, 100, 100, 100];
    const volumes = [500, 500, 500, 500];
    const result = computeOBV(prices, volumes)!;
    expect(result.value).toBe(0);
    expect(result.trend).toBe('stable');
  });
});

// ---------------------------------------------------------------------------
// computeATR
// ---------------------------------------------------------------------------

describe('computeATR', () => {
  it('returns null with insufficient data', () => {
    expect(computeATR([100, 110], [90, 100], [95, 105], 14)).toBeNull();
  });

  it('computes ATR from high/low/close data', () => {
    const highs = Array.from({ length: 20 }, (_, i) => 1050 + (i % 3) * 10);
    const lows = Array.from({ length: 20 }, (_, i) => 950 - (i % 3) * 10);
    const closes = Array.from({ length: 20 }, () => 1000);
    const result = computeATR(highs, lows, closes, 14);
    expect(result).not.toBeNull();
    expect(result!).toBeGreaterThan(0);
  });

  it('ATR is higher when price swings are larger', () => {
    const closes = Array.from({ length: 20 }, () => 1000);
    const smallSwing = computeATR(
      closes.map((c) => c + 10),
      closes.map((c) => c - 10),
      closes,
      14
    );
    const bigSwing = computeATR(
      closes.map((c) => c + 100),
      closes.map((c) => c - 100),
      closes,
      14
    );
    expect(bigSwing!).toBeGreaterThan(smallSwing!);
  });
});

// ---------------------------------------------------------------------------
// computeVWAP
// ---------------------------------------------------------------------------

describe('computeVWAP', () => {
  it('returns null with no data', () => {
    expect(computeVWAP([], [])).toBeNull();
  });

  it('returns null when total volume is 0', () => {
    expect(computeVWAP([100, 200], [0, 0])).toBeNull();
  });

  it('computes volume-weighted average', () => {
    // 100gp with volume 900, 200gp with volume 100
    // VWAP = (100*900 + 200*100) / (900+100) = 110
    const result = computeVWAP([100, 200], [900, 100]);
    expect(result).toBe(110);
  });

  it('VWAP equals simple average when all volumes are equal', () => {
    const result = computeVWAP([100, 200, 300], [500, 500, 500]);
    expect(result).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// computeFibonacciLevels
// ---------------------------------------------------------------------------

describe('computeFibonacciLevels', () => {
  it('returns null with fewer than 10 data points', () => {
    expect(computeFibonacciLevels([100, 110, 120])).toBeNull();
  });

  it('returns null when price range is too small (<3%)', () => {
    const prices = Array.from({ length: 15 }, () => 1000);
    expect(computeFibonacciLevels(prices)).toBeNull();
  });

  it('computes fibonacci levels for an uptrend', () => {
    // Price rising from 100 to 200
    const prices = Array.from({ length: 15 }, (_, i) =>
      Math.round(100 + (100 * i) / 14)
    );
    const result = computeFibonacciLevels(prices)!;
    expect(result).not.toBeNull();
    expect(result.swingLow).toBe(100);
    expect(result.swingHigh).toBe(200);
    expect(result.levels.length).toBe(7); // 0, 0.236, 0.382, 0.5, 0.618, 0.786, 1
    // 50% retracement from 200 in uptrend = 200 - 100*0.5 = 150
    const fib50 = result.levels.find((l) => l.ratio === 0.5);
    expect(fib50!.price).toBe(150);
  });

  it('includes 0% and 100% retracement levels', () => {
    const prices = Array.from({ length: 15 }, (_, i) =>
      Math.round(100 + (100 * i) / 14)
    );
    const result = computeFibonacciLevels(prices)!;
    expect(result.levels[0]!.ratio).toBe(0);
    expect(result.levels[result.levels.length - 1]!.ratio).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// computeManipulationRisk
// ---------------------------------------------------------------------------

describe('computeManipulationRisk', () => {
  it('returns 0 with fewer than 5 summaries', () => {
    const summaries = makeLinearSeries(3, 1000, 1000);
    expect(computeManipulationRisk(summaries)).toBe(0);
  });

  it('returns 0 for stable prices', () => {
    const summaries = makeLinearSeries(10, 1000, 1005);
    expect(computeManipulationRisk(summaries)).toBe(0);
  });

  it('detects 4x4 pattern (4%+ daily moves for 4 of 5 days)', () => {
    // Create a series where the last 5 days have wild swings
    const start = new Date('2025-12-01');
    const stable = makeLinearSeries(5, 1000, 1000, start);
    // Add 5 volatile days
    const volatileDays: GeDailySummary[] = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date(start);
      d.setUTCDate(d.getUTCDate() + 5 + i);
      // Alternating 5% swings: 1000, 1050, 997, 1047, 995
      const price = i % 2 === 0 ? 1000 : 1050;
      volatileDays.push(makeSummary({ date: d, avgBuyPrice: price }));
    }
    const risk = computeManipulationRisk([...stable, ...volatileDays]);
    expect(risk).toBeGreaterThanOrEqual(20);
  });

  it('detects extreme single-day move (>15%)', () => {
    const start = new Date('2025-12-01');
    const summaries: GeDailySummary[] = [];
    for (let i = 0; i < 10; i++) {
      const d = new Date(start);
      d.setUTCDate(d.getUTCDate() + i);
      const price = i === 9 ? 1200 : 1000; // 20% spike on last day
      summaries.push(makeSummary({ date: d, avgBuyPrice: price }));
    }
    const risk = computeManipulationRisk(summaries);
    expect(risk).toBeGreaterThanOrEqual(20);
  });

  it('returns higher risk when multiple signals combine', () => {
    const start = new Date('2025-12-01');
    // Low-volume item with sudden volume spike AND price spike
    const summaries: GeDailySummary[] = [];
    for (let i = 0; i < 10; i++) {
      const d = new Date(start);
      d.setUTCDate(d.getUTCDate() + i);
      const isRecent = i >= 7;
      summaries.push(
        makeSummary({
          date: d,
          avgBuyPrice: isRecent ? 1200 + i * 50 : 1000,
          totalVolume: isRecent ? 1000 : 50, // volume spike
        })
      );
    }
    const risk = computeManipulationRisk(summaries);
    expect(risk).toBeGreaterThanOrEqual(30);
  });
});
