/**
 * Risk Metrics
 *
 * Calculates portfolio risk metrics from a time-series of profit/loss values.
 * These help users understand the risk profile of their trading strategy:
 *
 *   - Max Drawdown: Largest peak-to-trough decline in cumulative P&L
 *   - Profit Factor: Gross profit / gross loss (> 1 = profitable)
 *   - Win Rate: Percentage of profitable trades
 *   - Sharpe-like Ratio: Risk-adjusted return (mean return / std dev)
 *   - Sortino-like Ratio: Like Sharpe but only penalises downside volatility
 *   - Expectancy: Average GP expected per trade
 *   - Risk Grade: Overall letter grade for strategy quality
 */

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export interface TradeResult {
  /** Profit or loss of a single completed trade (negative = loss) */
  profit: number;
  /** When the trade completed */
  tradedAt: Date;
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

export interface RiskMetrics {
  /** Total number of trades analysed */
  tradeCount: number;
  /** Win rate as a decimal (0–1) */
  winRate: number;
  /** Average profit per winning trade */
  averageWin: number;
  /** Average loss per losing trade (positive number) */
  averageLoss: number;
  /** Gross profit / gross loss. Infinity if no losses. null if no trades */
  profitFactor: number | null;
  /** Expected value per trade (winRate × avgWin - lossRate × avgLoss) */
  expectancy: number;
  /** Maximum peak-to-trough decline in cumulative P&L */
  maxDrawdown: number;
  /** Maximum drawdown as percentage of the peak value (0–100) */
  maxDrawdownPercent: number | null;
  /** Risk-adjusted return: mean / stdDev of returns. null if < 2 trades */
  sharpeRatio: number | null;
  /** Like Sharpe but only downside deviation. null if < 2 trades */
  sortinoRatio: number | null;
  /** Longest streak of consecutive wins */
  longestWinStreak: number;
  /** Longest streak of consecutive losses */
  longestLossStreak: number;
  /** Overall risk grade A–F */
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  /** Human-readable summary */
  summary: string;
}

// ---------------------------------------------------------------------------
// Calculation
// ---------------------------------------------------------------------------

/**
 * Compute risk metrics from an array of trade results.
 * Trades should be sorted chronologically (oldest first).
 */
export function calculateRiskMetrics(trades: TradeResult[]): RiskMetrics {
  if (trades.length === 0) {
    return {
      tradeCount: 0,
      winRate: 0,
      averageWin: 0,
      averageLoss: 0,
      profitFactor: null,
      expectancy: 0,
      maxDrawdown: 0,
      maxDrawdownPercent: null,
      sharpeRatio: null,
      sortinoRatio: null,
      longestWinStreak: 0,
      longestLossStreak: 0,
      grade: 'F',
      summary: 'No trades to analyse.',
    };
  }

  const profits = trades.map((t) => t.profit);

  // -- Win / Loss breakdown --
  const wins = profits.filter((p) => p > 0);
  const losses = profits.filter((p) => p < 0);
  const winRate = wins.length / profits.length;

  const grossProfit = wins.reduce((s, p) => s + p, 0);
  const grossLoss = Math.abs(losses.reduce((s, p) => s + p, 0));

  const averageWin = wins.length > 0 ? grossProfit / wins.length : 0;
  const averageLoss = losses.length > 0 ? grossLoss / losses.length : 0;

  const profitFactor =
    grossLoss > 0
      ? Math.round((grossProfit / grossLoss) * 100) / 100
      : grossProfit > 0
        ? Infinity
        : null;

  const expectancy = Math.round(
    winRate * averageWin - (1 - winRate) * averageLoss
  );

  // -- Max Drawdown --
  let peak = 0;
  let cumulative = 0;
  let maxDrawdown = 0;
  let peakAtMax = 0;

  for (const p of profits) {
    cumulative += p;
    if (cumulative > peak) {
      peak = cumulative;
    }
    const drawdown = peak - cumulative;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
      peakAtMax = peak;
    }
  }

  const maxDrawdownPercent =
    peakAtMax > 0 ? Math.round((maxDrawdown / peakAtMax) * 10000) / 100 : null;

  // -- Sharpe-like Ratio (mean / stddev) --
  let sharpeRatio: number | null = null;
  let sortinoRatio: number | null = null;

  if (profits.length >= 2) {
    const mean = profits.reduce((s, p) => s + p, 0) / profits.length;

    // Standard deviation
    const variance =
      profits.reduce((s, p) => s + (p - mean) ** 2, 0) / (profits.length - 1);
    const stdDev = Math.sqrt(variance);

    if (stdDev > 0) {
      sharpeRatio = Math.round((mean / stdDev) * 100) / 100;
    }

    // Downside deviation (only negative returns)
    const downsideVariance =
      profits.filter((p) => p < mean).reduce((s, p) => s + (p - mean) ** 2, 0) /
      (profits.length - 1);
    const downsideDev = Math.sqrt(downsideVariance);

    if (downsideDev > 0) {
      sortinoRatio = Math.round((mean / downsideDev) * 100) / 100;
    }
  }

  // -- Streaks --
  let longestWinStreak = 0;
  let longestLossStreak = 0;
  let currentWinStreak = 0;
  let currentLossStreak = 0;

  for (const p of profits) {
    if (p > 0) {
      currentWinStreak++;
      currentLossStreak = 0;
      if (currentWinStreak > longestWinStreak)
        longestWinStreak = currentWinStreak;
    } else if (p < 0) {
      currentLossStreak++;
      currentWinStreak = 0;
      if (currentLossStreak > longestLossStreak)
        longestLossStreak = currentLossStreak;
    } else {
      // breakeven resets both
      currentWinStreak = 0;
      currentLossStreak = 0;
    }
  }

  // -- Grade --
  const grade = computeRiskGrade(
    winRate,
    profitFactor,
    maxDrawdownPercent,
    sharpeRatio
  );

  const summary = buildRiskSummary(
    grade,
    trades.length,
    winRate,
    profitFactor,
    maxDrawdown,
    expectancy
  );

  return {
    tradeCount: trades.length,
    winRate: Math.round(winRate * 10000) / 10000,
    averageWin: Math.round(averageWin),
    averageLoss: Math.round(averageLoss),
    profitFactor,
    expectancy,
    maxDrawdown,
    maxDrawdownPercent,
    sharpeRatio,
    sortinoRatio,
    longestWinStreak,
    longestLossStreak,
    grade,
    summary,
  };
}

// ---------------------------------------------------------------------------
// Grading
// ---------------------------------------------------------------------------

function computeRiskGrade(
  winRate: number,
  profitFactor: number | null,
  maxDrawdownPct: number | null,
  sharpe: number | null
): RiskMetrics['grade'] {
  let score = 0;

  // Win rate (0–25 points)
  if (winRate >= 0.6) score += 25;
  else if (winRate >= 0.5) score += 20;
  else if (winRate >= 0.4) score += 10;

  // Profit factor (0–25 points)
  if (profitFactor !== null && profitFactor !== Infinity) {
    if (profitFactor >= 2) score += 25;
    else if (profitFactor >= 1.5) score += 20;
    else if (profitFactor >= 1) score += 10;
  } else if (profitFactor === Infinity) {
    score += 25; // No losses
  }

  // Max drawdown (0–25 points) — lower is better
  if (maxDrawdownPct !== null) {
    if (maxDrawdownPct <= 10) score += 25;
    else if (maxDrawdownPct <= 25) score += 20;
    else if (maxDrawdownPct <= 50) score += 10;
  } else {
    score += 15; // No drawdown data (maybe no peak yet)
  }

  // Sharpe (0–25 points)
  if (sharpe !== null) {
    if (sharpe >= 1) score += 25;
    else if (sharpe >= 0.5) score += 20;
    else if (sharpe >= 0) score += 10;
  }

  if (score >= 80) return 'A';
  if (score >= 60) return 'B';
  if (score >= 40) return 'C';
  if (score >= 20) return 'D';
  return 'F';
}

function buildRiskSummary(
  grade: RiskMetrics['grade'],
  tradeCount: number,
  winRate: number,
  profitFactor: number | null,
  maxDrawdown: number,
  expectancy: number
): string {
  const winPct = Math.round(winRate * 100);
  const pfStr =
    profitFactor === Infinity
      ? 'no losses'
      : profitFactor !== null
        ? `profit factor ${profitFactor}`
        : 'unknown profit factor';

  switch (grade) {
    case 'A':
      return `Excellent strategy over ${tradeCount} trades: ${winPct}% win rate, ${pfStr}, +${expectancy.toLocaleString()} gp expected per trade.`;
    case 'B':
      return `Good strategy over ${tradeCount} trades: ${winPct}% win rate, ${pfStr}.`;
    case 'C':
      return `Average strategy: ${winPct}% win rate with ${maxDrawdown.toLocaleString()} gp max drawdown.`;
    case 'D':
      return `Below average: ${winPct}% win rate. Consider adjusting your approach.`;
    case 'F':
      return `Poor performance: ${winPct}% win rate, ${maxDrawdown.toLocaleString()} gp max drawdown. Review your strategy.`;
  }
}
