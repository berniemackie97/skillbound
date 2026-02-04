import { describe, expect, it } from 'vitest';

import {
  calculateFifoProfit,
  calculateTotalValue,
  formatGpDisplay,
  getPeriodStartDate,
  type ProfitMatch,
} from './trading-service';

describe('calculateTotalValue', () => {
  it('calculates total value from quantity and price', () => {
    expect(calculateTotalValue(10, 100)).toBe(1000);
    expect(calculateTotalValue(5, 2000)).toBe(10000);
    expect(calculateTotalValue(1, 1)).toBe(1);
  });

  it('handles zero values', () => {
    expect(calculateTotalValue(0, 100)).toBe(0);
    expect(calculateTotalValue(10, 0)).toBe(0);
  });
});

describe('calculateFifoProfit', () => {
  it('returns empty for no buys', () => {
    const result = calculateFifoProfit([], 100, 10);
    expect(result.profit).toBe(0);
    expect(result.matches).toEqual([]);
  });

  it('matches single buy to sell with profit', () => {
    const buys = [
      { tradeId: 'buy-1', remaining: 10, pricePerItem: 80 },
    ];
    const result = calculateFifoProfit(buys, 100, 10);

    expect(result.profit).toBe(200); // (100 - 80) * 10
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]).toEqual({
      buyTradeId: 'buy-1',
      quantityMatched: 10,
      buyPrice: 80,
      sellPrice: 100,
      profit: 200,
    });
  });

  it('matches multiple buys FIFO order', () => {
    const buys = [
      { tradeId: 'buy-1', remaining: 5, pricePerItem: 80 },
      { tradeId: 'buy-2', remaining: 10, pricePerItem: 90 },
    ];
    const result = calculateFifoProfit(buys, 100, 8);

    // (100 - 80) * 5 = 100 profit from first buy
    // (100 - 90) * 3 = 30 profit from second buy
    // Total: 130
    expect(result.profit).toBe(130);
    expect(result.matches).toHaveLength(2);
    expect(result.matches[0]?.quantityMatched).toBe(5);
    expect(result.matches[1]?.quantityMatched).toBe(3);
  });

  it('handles loss scenario', () => {
    const buys = [
      { tradeId: 'buy-1', remaining: 10, pricePerItem: 120 },
    ];
    const result = calculateFifoProfit(buys, 100, 10);

    expect(result.profit).toBe(-200); // (100 - 120) * 10
  });

  it('only uses available remaining quantity', () => {
    const buys = [
      { tradeId: 'buy-1', remaining: 3, pricePerItem: 80 },
    ];
    const result = calculateFifoProfit(buys, 100, 10);

    expect(result.profit).toBe(60); // (100 - 80) * 3
    expect(result.matches[0]?.quantityMatched).toBe(3);
  });
});

describe('formatGpDisplay', () => {
  it('formats small values with commas', () => {
    expect(formatGpDisplay(999)).toBe('999');
    expect(formatGpDisplay(1)).toBe('1');
  });

  it('formats thousands with k suffix', () => {
    expect(formatGpDisplay(1000)).toBe('1.0k');
    expect(formatGpDisplay(5500)).toBe('5.5k');
    expect(formatGpDisplay(999999)).toBe('1000.0k');
  });

  it('formats millions with m suffix', () => {
    expect(formatGpDisplay(1_000_000)).toBe('1.00m');
    expect(formatGpDisplay(25_500_000)).toBe('25.50m');
    expect(formatGpDisplay(999_999_999)).toBe('1000.00m');
  });

  it('formats billions with b suffix', () => {
    expect(formatGpDisplay(1_000_000_000)).toBe('1.00b');
    expect(formatGpDisplay(2_500_000_000)).toBe('2.50b');
  });

  it('handles negative values', () => {
    expect(formatGpDisplay(-5000)).toBe('-5.0k');
    expect(formatGpDisplay(-1_000_000)).toBe('-1.00m');
  });
});

describe('getPeriodStartDate', () => {
  const now = new Date('2026-01-26T12:00:00.000Z');

  it('returns null for "all" period', () => {
    expect(getPeriodStartDate('all', now)).toBeNull();
  });

  it('returns start of today for "today" period', () => {
    const result = getPeriodStartDate('today', now);
    // The function creates a date at midnight in local timezone
    // Just verify it's on the same day and at midnight local time
    expect(result).toBeDefined();
    if (!result) throw new Error('Expected result to be defined');
    expect(result.getFullYear()).toBe(now.getFullYear());
    expect(result.getMonth()).toBe(now.getMonth());
    expect(result.getDate()).toBe(now.getDate());
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
  });

  it('returns 7 days ago for "week" period', () => {
    const result = getPeriodStartDate('week', now);
    expect(result).toBeDefined();
    if (!result) throw new Error('Expected result to be defined');
    const diffMs = now.getTime() - result.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    expect(diffDays).toBe(7);
  });

  it('returns 30 days ago for "month" period', () => {
    const result = getPeriodStartDate('month', now);
    expect(result).toBeDefined();
    if (!result) throw new Error('Expected result to be defined');
    const diffMs = now.getTime() - result.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    expect(diffDays).toBe(30);
  });

  it('returns 365 days ago for "year" period', () => {
    const result = getPeriodStartDate('year', now);
    expect(result).toBeDefined();
    if (!result) throw new Error('Expected result to be defined');
    const diffMs = now.getTime() - result.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    expect(diffDays).toBe(365);
  });
});

describe('ProfitMatch type', () => {
  it('has correct structure', () => {
    const match: ProfitMatch = {
      buyTradeId: 'test-buy-id',
      quantityMatched: 10,
      buyPrice: 100,
      sellPrice: 150,
      profit: 500,
    };

    expect(match.buyTradeId).toBe('test-buy-id');
    expect(match.quantityMatched).toBe(10);
    expect(match.profit).toBe(500);
  });
});
