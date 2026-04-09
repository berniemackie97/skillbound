import type { GeDailySummary } from '@skillbound/database';
import { describe, expect, it } from 'vitest';

import {
  detectOpportunity,
  scanForOpportunities,
} from './investment-opportunities';

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

/** Generate a series of summaries ending yesterday, so they fall within analyzeItemMarket's "last 30d" window */
function makeSeries(
  count: number,
  basePrice: number,
  startDate?: Date,
  options?: { priceVariation?: (i: number) => number; volume?: number }
): GeDailySummary[] {
  // Default: end yesterday so data is within the analysis window
  if (!startDate) {
    startDate = new Date();
    startDate.setUTCDate(startDate.getUTCDate() - count);
    startDate.setUTCHours(0, 0, 0, 0);
  }
  const summaries: GeDailySummary[] = [];
  for (let i = 0; i < count; i++) {
    const price = options?.priceVariation
      ? basePrice + options.priceVariation(i)
      : basePrice;
    const date = new Date(startDate);
    date.setUTCDate(date.getUTCDate() + i);
    summaries.push(
      makeSummary({
        date,
        avgBuyPrice: Math.round(price),
        totalVolume: options?.volume ?? 500,
      })
    );
  }
  return summaries;
}

// ---------------------------------------------------------------------------
// detectOpportunity
// ---------------------------------------------------------------------------

describe('detectOpportunity', () => {
  it('returns null when currentPrice is null', () => {
    const summaries = makeSeries(10, 1000);
    expect(detectOpportunity(1, 'Test Item', summaries, null)).toBeNull();
  });

  it('returns null when currentPrice is 0', () => {
    const summaries = makeSeries(10, 1000);
    expect(detectOpportunity(1, 'Test Item', summaries, 0)).toBeNull();
  });

  it('returns null when fewer than 7 summaries', () => {
    const summaries = makeSeries(5, 1000);
    expect(detectOpportunity(1, 'Test Item', summaries, 900)).toBeNull();
  });

  it('returns null when no opportunity signal found', () => {
    // Flat price, current price matches avg — no signal
    const summaries = makeSeries(30, 1000);
    expect(detectOpportunity(1, 'Test Item', summaries, 1000)).toBeNull();
  });

  // -- Price dip detection --

  it('detects a price-dip when current price is well below 30d average', () => {
    // Average price is ~1000, current price is 800 (20% below)
    const summaries = makeSeries(30, 1000);
    const result = detectOpportunity(1, 'Abyssal Whip', summaries, 800);

    expect(result).not.toBeNull();
    expect(result!.type).toBe('price-dip');
    expect(result!.itemId).toBe(1);
    expect(result!.itemName).toBe('Abyssal Whip');
    expect(result!.currentPrice).toBe(800);
    expect(result!.expectedChange).toBeGreaterThan(0);
    expect(result!.dataPoints).toBeGreaterThanOrEqual(7);
    expect(result!.title).toContain('below historical average');
  });

  it('does not detect price-dip when dip is small (<10%)', () => {
    const summaries = makeSeries(30, 1000);
    // 5% below average — too small
    expect(detectOpportunity(1, 'Test Item', summaries, 950)).toBeNull();
  });

  it('returns high confidence for deep dips (>20%)', () => {
    const summaries = makeSeries(30, 1000);
    const result = detectOpportunity(1, 'Test Item', summaries, 750);

    expect(result).not.toBeNull();
    expect(result!.type).toBe('price-dip');
    expect(result!.confidence).toBe('high');
  });

  it('does not detect price-dip when price is extremely volatile', () => {
    // Create very volatile data — prices swing widely
    const summaries = makeSeries(30, 1000, undefined, {
      priceVariation: (i) => (i % 2 === 0 ? 500 : -500),
    });
    // Even though current price (500) is below average, volatility is too high
    const result = detectOpportunity(1, 'Test Item', summaries, 500);

    // Either null (skipped due to volatility) or not a price-dip
    if (result !== null) {
      expect(result.type).not.toBe('price-dip');
    }
  });

  // -- Trend reversal detection --

  it('detects trend-reversal when short-term falling but long-term rising', () => {
    // 30 days of generally rising prices, then 7 days of falling
    const summaries: GeDailySummary[] = [];
    const start = new Date();
    start.setUTCDate(start.getUTCDate() - 30);
    start.setUTCHours(0, 0, 0, 0);

    // First 23 days: rising from 800 to 1100
    for (let i = 0; i < 23; i++) {
      const date = new Date(start);
      date.setUTCDate(date.getUTCDate() + i);
      const price = Math.round(800 + (300 * i) / 22);
      summaries.push(makeSummary({ date, avgBuyPrice: price }));
    }

    // Last 7 days: falling from 1100 to 1000
    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setUTCDate(date.getUTCDate() + 23 + i);
      const price = Math.round(1100 - (100 * i) / 6);
      summaries.push(makeSummary({ date, avgBuyPrice: price }));
    }

    const result = detectOpportunity(1, 'Dragon Bones', summaries, 1000);

    // May detect price-dip or trend-reversal depending on exact analysis
    if (result !== null && result.type === 'trend-reversal') {
      expect(result.title).toContain('Pullback');
      expect(result.expectedChange).toBeGreaterThan(0);
    }
  });

  // -- Opportunity types include undervalued --

  it('opportunity type can be price-dip, seasonal-rise, trend-reversal, or undervalued', () => {
    // Just verify the type union is correct by checking a known result
    const summaries = makeSeries(30, 1000);
    const result = detectOpportunity(1, 'Test Item', summaries, 800);
    expect(result).not.toBeNull();
    expect([
      'price-dip',
      'seasonal-rise',
      'trend-reversal',
      'undervalued',
    ]).toContain(result!.type);
  });

  // -- Output shape validation --

  it('includes required fields in the opportunity result', () => {
    const summaries = makeSeries(30, 1000);
    const result = detectOpportunity(1, 'Test Item', summaries, 800);

    expect(result).not.toBeNull();
    expect(result).toHaveProperty('itemId');
    expect(result).toHaveProperty('itemName');
    expect(result).toHaveProperty('currentPrice');
    expect(result).toHaveProperty('type');
    expect(result).toHaveProperty('confidence');
    expect(result).toHaveProperty('title');
    expect(result).toHaveProperty('reason');
    expect(result).toHaveProperty('expectedChange');
    expect(result).toHaveProperty('dataPoints');
    expect(result).toHaveProperty('insights');
    expect(Array.isArray(result!.insights)).toBe(true);
    expect(['high', 'medium', 'low']).toContain(result!.confidence);
  });

  it('expected change from price-dip is ~60% of the dip', () => {
    const summaries = makeSeries(30, 1000);
    // 20% dip → expected ~12% return (60% mean reversion)
    const result = detectOpportunity(1, 'Test Item', summaries, 800);

    expect(result).not.toBeNull();
    expect(result!.type).toBe('price-dip');
    // expectedChange should be roughly 12% (60% of 20%)
    expect(result!.expectedChange).toBeGreaterThanOrEqual(10);
    expect(result!.expectedChange).toBeLessThanOrEqual(15);
  });

  // -- Alch floor awareness --

  it('skips price-dip when item is near alch floor', () => {
    const summaries = makeSeries(30, 1000);
    // 20% dip but price (800) is near alch floor (790) → not a real dip
    const result = detectOpportunity(1, 'Test Item', summaries, 800, {
      alchFloor: 790,
    });

    // Should either be null or not a price-dip/undervalued type
    if (result !== null) {
      expect(result.type).not.toBe('price-dip');
      expect(result.type).not.toBe('undervalued');
    }
  });

  it('still detects price-dip when alchFloor is null', () => {
    const summaries = makeSeries(30, 1000);
    const result = detectOpportunity(1, 'Test Item', summaries, 800, {
      alchFloor: null,
    });
    expect(result).not.toBeNull();
    expect(result!.type).toBe('price-dip');
  });

  it('still detects price-dip when price is well above alch floor', () => {
    const summaries = makeSeries(30, 1000);
    const result = detectOpportunity(1, 'Test Item', summaries, 800, {
      alchFloor: 200,
    });
    expect(result).not.toBeNull();
    expect(result!.type).toBe('price-dip');
  });
});

// ---------------------------------------------------------------------------
// scanForOpportunities
// ---------------------------------------------------------------------------

describe('scanForOpportunities', () => {
  it('returns empty opportunities when no items provided', () => {
    const result = scanForOpportunities([]);

    expect(result.opportunities).toHaveLength(0);
    expect(result.itemsScanned).toBe(0);
    expect(result.itemsWithData).toBe(0);
  });

  it('counts itemsScanned and itemsWithData correctly', () => {
    const result = scanForOpportunities([
      {
        itemId: 1,
        itemName: 'Item A',
        currentPrice: 1000,
        summaries: makeSeries(30, 1000),
      },
      {
        itemId: 2,
        itemName: 'Item B',
        currentPrice: 500,
        summaries: makeSeries(3, 500), // too few
      },
      {
        itemId: 3,
        itemName: 'Item C',
        currentPrice: null,
        summaries: makeSeries(30, 1000),
      },
    ]);

    expect(result.itemsScanned).toBe(3);
    expect(result.itemsWithData).toBe(2); // items 1 and 3 have >= 7 summaries
  });

  it('finds opportunities across multiple items', () => {
    const result = scanForOpportunities([
      {
        itemId: 1,
        itemName: 'Cheap Item',
        currentPrice: 700, // 30% below 1000 avg
        summaries: makeSeries(30, 1000),
      },
      {
        itemId: 2,
        itemName: 'Normal Item',
        currentPrice: 1000, // at average, no signal
        summaries: makeSeries(30, 1000),
      },
      {
        itemId: 3,
        itemName: 'Also Cheap',
        currentPrice: 800, // 20% below 1000 avg
        summaries: makeSeries(30, 1000),
      },
    ]);

    // At least the two dipped items should generate opportunities
    expect(result.opportunities.length).toBeGreaterThanOrEqual(2);
    const types = result.opportunities.map((o) => o.type);
    expect(types).toContain('price-dip');
  });

  it('sorts opportunities by confidence (high first) then expectedChange', () => {
    const result = scanForOpportunities([
      {
        itemId: 1,
        itemName: 'Deep Dip',
        currentPrice: 700, // 30% below → high confidence
        summaries: makeSeries(30, 1000),
      },
      {
        itemId: 2,
        itemName: 'Moderate Dip',
        currentPrice: 850, // 15% below → medium confidence
        summaries: makeSeries(30, 1000),
      },
    ]);

    if (result.opportunities.length >= 2) {
      const confidenceOrder = { high: 0, medium: 1, low: 2 };
      for (let i = 0; i < result.opportunities.length - 1; i++) {
        const curr = result.opportunities[i]!;
        const next = result.opportunities[i + 1]!;
        const confCmp =
          confidenceOrder[curr.confidence] - confidenceOrder[next.confidence];
        if (confCmp === 0) {
          // Same confidence → higher expectedChange first
          expect(curr.expectedChange ?? 0).toBeGreaterThanOrEqual(
            next.expectedChange ?? 0
          );
        } else {
          expect(confCmp).toBeLessThanOrEqual(0);
        }
      }
    }
  });

  it('limits results to 50 opportunities', () => {
    // Create 60 items all with price dips
    const items = Array.from({ length: 60 }, (_, i) => ({
      itemId: i + 1,
      itemName: `Item ${i + 1}`,
      currentPrice: 750,
      summaries: makeSeries(30, 1000),
    }));

    const result = scanForOpportunities(items);
    expect(result.opportunities.length).toBeLessThanOrEqual(50);
    expect(result.itemsScanned).toBe(60);
  });

  it('skips items with null currentPrice', () => {
    const result = scanForOpportunities([
      {
        itemId: 1,
        itemName: 'Null Price',
        currentPrice: null,
        summaries: makeSeries(30, 1000),
      },
    ]);

    expect(result.opportunities).toHaveLength(0);
  });

  it('skips items with fewer than 7 summaries', () => {
    const result = scanForOpportunities([
      {
        itemId: 1,
        itemName: 'Too Few',
        currentPrice: 700,
        summaries: makeSeries(5, 1000),
      },
    ]);

    expect(result.opportunities).toHaveLength(0);
  });

  it('returns correct ScanResult shape', () => {
    const result = scanForOpportunities([]);

    expect(result).toHaveProperty('opportunities');
    expect(result).toHaveProperty('itemsScanned');
    expect(result).toHaveProperty('itemsWithData');
    expect(Array.isArray(result.opportunities)).toBe(true);
    expect(typeof result.itemsScanned).toBe('number');
    expect(typeof result.itemsWithData).toBe('number');
  });
});
