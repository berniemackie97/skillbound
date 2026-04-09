import { describe, expect, it } from 'vitest';

import { estimateFillTime, estimateFlipCycleTime } from './fill-time';

// ---------------------------------------------------------------------------
// estimateFillTime
// ---------------------------------------------------------------------------

describe('estimateFillTime', () => {
  it('returns unknown when no data', () => {
    const result = estimateFillTime({
      quantity: 100,
      buyLimit: null,
      hourlyVolume: null,
      orderType: 'buy',
    });
    expect(result.estimatedHours).toBeNull();
    expect(result.confidence).toBe('unknown');
    expect(result.formatted).toBe('Unknown');
  });

  it('estimates by volume when no buy limit', () => {
    const result = estimateFillTime({
      quantity: 100,
      buyLimit: null,
      hourlyVolume: 50,
      orderType: 'buy',
    });
    expect(result.estimatedHours).toBe(2);
    expect(result.bottleneck).toBe('volume');
  });

  it('estimates by buy limit when it is slower', () => {
    // Buy limit: 10 per 4h → need 10 cycles for 100 items = 40h
    // Volume: 100/hr → 1h by volume
    // Buy limit is the bottleneck
    const result = estimateFillTime({
      quantity: 100,
      buyLimit: 10,
      hourlyVolume: 100,
      orderType: 'buy',
    });
    expect(result.estimatedHours).toBe(40);
    expect(result.cyclesNeeded).toBe(10);
    expect(result.multiCycle).toBe(true);
    expect(result.bottleneck).toBe('buy-limit');
  });

  it('ignores buy limit for sell orders', () => {
    const result = estimateFillTime({
      quantity: 100,
      buyLimit: 10,
      hourlyVolume: 50,
      orderType: 'sell',
    });
    expect(result.estimatedHours).toBe(2);
    expect(result.bottleneck).toBe('volume');
    expect(result.cyclesNeeded).toBeNull();
  });

  it('single cycle when quantity within buy limit', () => {
    const result = estimateFillTime({
      quantity: 5,
      buyLimit: 10,
      hourlyVolume: 100,
      orderType: 'buy',
    });
    expect(result.cyclesNeeded).toBe(1);
    expect(result.multiCycle).toBe(false);
    expect(result.estimatedHours).toBe(4); // 1 cycle = 4h (buy limit floor)
  });

  it('high confidence for high volume items', () => {
    const result = estimateFillTime({
      quantity: 10,
      buyLimit: null,
      hourlyVolume: 500,
      orderType: 'buy',
    });
    expect(result.confidence).toBe('high');
  });

  it('medium confidence for moderate volume', () => {
    const result = estimateFillTime({
      quantity: 10,
      buyLimit: null,
      hourlyVolume: 50,
      orderType: 'buy',
    });
    expect(result.confidence).toBe('medium');
  });

  it('low confidence for low volume', () => {
    const result = estimateFillTime({
      quantity: 10,
      buyLimit: null,
      hourlyVolume: 5,
      orderType: 'buy',
    });
    expect(result.confidence).toBe('low');
  });

  it('formats minutes correctly', () => {
    const result = estimateFillTime({
      quantity: 10,
      buyLimit: null,
      hourlyVolume: 20,
      orderType: 'buy',
    });
    // 10/20 = 0.5h = 30 min
    expect(result.formatted).toBe('~30 min');
  });

  it('formats hours correctly', () => {
    const result = estimateFillTime({
      quantity: 100,
      buyLimit: null,
      hourlyVolume: 20,
      orderType: 'buy',
    });
    // 100/20 = 5h
    expect(result.formatted).toBe('~5h');
  });

  it('formats days correctly', () => {
    const result = estimateFillTime({
      quantity: 1000,
      buyLimit: 10,
      hourlyVolume: 100,
      orderType: 'buy',
    });
    // 100 cycles * 4h = 400h ≈ 16.7 days
    expect(result.formatted).toContain('days');
  });

  it('uses buy limit only when volume is null', () => {
    const result = estimateFillTime({
      quantity: 20,
      buyLimit: 10,
      hourlyVolume: null,
      orderType: 'buy',
    });
    expect(result.estimatedHours).toBe(8); // 2 cycles * 4h
    expect(result.bottleneck).toBe('buy-limit');
  });
});

// ---------------------------------------------------------------------------
// estimateFlipCycleTime
// ---------------------------------------------------------------------------

describe('estimateFlipCycleTime', () => {
  it('combines buy and sell estimates', () => {
    const result = estimateFlipCycleTime(10, 100, 50);
    // Buy: max(4h buy-limit, 0.2h volume) = 4h
    // Sell: 0.2h (no buy limit)
    expect(result.buyEstimate.estimatedHours).toBe(4);
    expect(result.sellEstimate.estimatedHours).toBe(0.2);
    expect(result.totalHours).toBe(4.2);
  });

  it('returns null total when data missing', () => {
    const result = estimateFlipCycleTime(10, null, null);
    expect(result.totalHours).toBeNull();
    expect(result.formatted).toBe('Unknown');
  });
});
