import { describe, expect, it } from 'vitest';

import { calculateRiskMetrics, type TradeResult } from './risk-metrics';

const d = (day: number) => new Date(2025, 0, day);

describe('calculateRiskMetrics', () => {
  it('returns defaults for empty input', () => {
    const result = calculateRiskMetrics([]);
    expect(result.tradeCount).toBe(0);
    expect(result.winRate).toBe(0);
    expect(result.grade).toBe('F');
    expect(result.profitFactor).toBeNull();
  });

  it('computes win rate correctly', () => {
    const trades: TradeResult[] = [
      { profit: 100, tradedAt: d(1) },
      { profit: -50, tradedAt: d(2) },
      { profit: 200, tradedAt: d(3) },
      { profit: 150, tradedAt: d(4) },
    ];
    const result = calculateRiskMetrics(trades);
    expect(result.winRate).toBe(0.75);
    expect(result.tradeCount).toBe(4);
  });

  it('computes average win and loss', () => {
    const trades: TradeResult[] = [
      { profit: 100, tradedAt: d(1) },
      { profit: 200, tradedAt: d(2) },
      { profit: -60, tradedAt: d(3) },
    ];
    const result = calculateRiskMetrics(trades);
    expect(result.averageWin).toBe(150); // (100 + 200) / 2
    expect(result.averageLoss).toBe(60); // |(-60)| / 1
  });

  it('computes profit factor', () => {
    const trades: TradeResult[] = [
      { profit: 300, tradedAt: d(1) },
      { profit: -100, tradedAt: d(2) },
    ];
    const result = calculateRiskMetrics(trades);
    expect(result.profitFactor).toBe(3); // 300 / 100
  });

  it('returns Infinity profit factor when no losses', () => {
    const trades: TradeResult[] = [
      { profit: 100, tradedAt: d(1) },
      { profit: 200, tradedAt: d(2) },
    ];
    const result = calculateRiskMetrics(trades);
    expect(result.profitFactor).toBe(Infinity);
  });

  it('computes max drawdown', () => {
    // Cumulative: 100, 200, 50, 100 → peak=200, trough=50, drawdown=150
    const trades: TradeResult[] = [
      { profit: 100, tradedAt: d(1) },
      { profit: 100, tradedAt: d(2) },
      { profit: -150, tradedAt: d(3) },
      { profit: 50, tradedAt: d(4) },
    ];
    const result = calculateRiskMetrics(trades);
    expect(result.maxDrawdown).toBe(150);
    expect(result.maxDrawdownPercent).toBe(75); // 150/200 = 75%
  });

  it('computes max drawdown percent as null when no peak', () => {
    // All losses: cumulative never goes positive
    const trades: TradeResult[] = [
      { profit: -100, tradedAt: d(1) },
      { profit: -50, tradedAt: d(2) },
    ];
    const result = calculateRiskMetrics(trades);
    expect(result.maxDrawdown).toBe(150);
    expect(result.maxDrawdownPercent).toBeNull();
  });

  it('computes sharpe ratio', () => {
    // Equal returns → zero std dev → null sharpe
    const equalTrades: TradeResult[] = [
      { profit: 100, tradedAt: d(1) },
      { profit: 100, tradedAt: d(2) },
    ];
    expect(calculateRiskMetrics(equalTrades).sharpeRatio).toBeNull();

    // Variable returns
    const trades: TradeResult[] = [
      { profit: 100, tradedAt: d(1) },
      { profit: -50, tradedAt: d(2) },
      { profit: 200, tradedAt: d(3) },
      { profit: 50, tradedAt: d(4) },
    ];
    const result = calculateRiskMetrics(trades);
    expect(result.sharpeRatio).not.toBeNull();
    expect(result.sharpeRatio!).toBeGreaterThan(0); // positive mean, so positive sharpe
  });

  it('computes sortino ratio', () => {
    const trades: TradeResult[] = [
      { profit: 100, tradedAt: d(1) },
      { profit: -50, tradedAt: d(2) },
      { profit: 200, tradedAt: d(3) },
    ];
    const result = calculateRiskMetrics(trades);
    expect(result.sortinoRatio).not.toBeNull();
    // Sortino should be >= Sharpe (only downside deviation)
    expect(result.sortinoRatio!).toBeGreaterThanOrEqual(result.sharpeRatio!);
  });

  it('returns null sharpe for single trade', () => {
    const trades: TradeResult[] = [{ profit: 100, tradedAt: d(1) }];
    const result = calculateRiskMetrics(trades);
    expect(result.sharpeRatio).toBeNull();
    expect(result.sortinoRatio).toBeNull();
  });

  it('computes win/loss streaks', () => {
    const trades: TradeResult[] = [
      { profit: 100, tradedAt: d(1) },
      { profit: 100, tradedAt: d(2) },
      { profit: 100, tradedAt: d(3) },
      { profit: -50, tradedAt: d(4) },
      { profit: -50, tradedAt: d(5) },
      { profit: 100, tradedAt: d(6) },
    ];
    const result = calculateRiskMetrics(trades);
    expect(result.longestWinStreak).toBe(3);
    expect(result.longestLossStreak).toBe(2);
  });

  it('computes expectancy', () => {
    const trades: TradeResult[] = [
      { profit: 200, tradedAt: d(1) },
      { profit: -100, tradedAt: d(2) },
      { profit: 200, tradedAt: d(3) },
      { profit: -100, tradedAt: d(4) },
    ];
    const result = calculateRiskMetrics(trades);
    // winRate=0.5, avgWin=200, avgLoss=100
    // expectancy = 0.5*200 - 0.5*100 = 50
    expect(result.expectancy).toBe(50);
  });

  it('grades excellent strategy as A', () => {
    // High win rate, no losses, consistent
    const trades: TradeResult[] = Array.from({ length: 20 }, (_, i) => ({
      profit: 100 + i * 10,
      tradedAt: d(i + 1),
    }));
    const result = calculateRiskMetrics(trades);
    expect(result.grade).toBe('A');
  });

  it('grades all-loss strategy as F', () => {
    const trades: TradeResult[] = Array.from({ length: 10 }, (_, i) => ({
      profit: -100,
      tradedAt: d(i + 1),
    }));
    const result = calculateRiskMetrics(trades);
    expect(result.grade).toBe('F');
    expect(result.winRate).toBe(0);
  });

  it('breakeven trades reset streaks', () => {
    const trades: TradeResult[] = [
      { profit: 100, tradedAt: d(1) },
      { profit: 0, tradedAt: d(2) },
      { profit: 100, tradedAt: d(3) },
    ];
    const result = calculateRiskMetrics(trades);
    expect(result.longestWinStreak).toBe(1);
  });

  it('summary contains trade count', () => {
    const trades: TradeResult[] = [
      { profit: 100, tradedAt: d(1) },
      { profit: 200, tradedAt: d(2) },
    ];
    const result = calculateRiskMetrics(trades);
    expect(result.summary).toContain('2');
  });
});
