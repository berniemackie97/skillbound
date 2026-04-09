/**
 * Market Analysis Engine
 *
 * Analyzes persisted historical data to detect trends, seasonal patterns,
 * and market anomalies. Produces actionable insights like:
 *   - "This item typically rises 15% in December"
 *   - "Price is currently 20% below its 30-day average — potential buy"
 *   - "Volume has been declining for 2 weeks — liquidity risk"
 *   - "This item is being actively flipped — unusual volume pattern"
 */

import type { GeDailySummary } from '@skillbound/database';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TrendDirection = 'rising' | 'falling' | 'stable';
export type Confidence = 'high' | 'medium' | 'low';

export interface PriceTrend {
  direction: TrendDirection;
  changePercent: number; // positive = up, negative = down
  period: string; // e.g. "7d", "30d"
  confidence: Confidence;
}

export interface VolumeTrend {
  direction: TrendDirection;
  changePercent: number;
  period: string;
  avgVolume: number;
  recentAvgVolume: number;
}

export interface SeasonalPattern {
  month: number; // 1-12
  monthName: string;
  avgPriceChange: number; // percent change during this month historically
  avgVolumeChange: number;
  sampleSize: number; // how many years of data contributed
  confidence: Confidence;
}

export interface PriceLevel {
  type: 'support' | 'resistance';
  price: number;
  strength: number; // 0-100, how many times price bounced off this level
}

export interface MarketInsight {
  type:
    | 'buy-signal'
    | 'sell-signal'
    | 'trend-alert'
    | 'seasonal-pattern'
    | 'volume-alert'
    | 'manipulation-warning'
    | 'info';
  title: string;
  description: string;
  confidence: Confidence;
}

export interface ItemMarketAnalysis {
  itemId: number;
  dataPoints: number; // total daily summaries analyzed
  dataSpanDays: number; // calendar days between first and last data point

  // Current price vs historical context
  currentPrice: number | null;
  avgPrice30d: number | null;
  avgPrice90d: number | null;
  priceVsAvg30d: number | null; // percent above/below 30d avg
  priceVsAvg90d: number | null;

  // Trend analysis
  priceTrend7d: PriceTrend | null;
  priceTrend30d: PriceTrend | null;
  volumeTrend: VolumeTrend | null;

  // Volatility
  priceVolatility30d: number | null; // coefficient of variation (stddev/mean * 100)

  // Extended timeframe averages
  avgPrice365d: number | null;
  priceVsAvg365d: number | null;

  // Technical indicators
  rsi14d: number | null; // Relative Strength Index (0-100)
  bollingerBands: { upper: number; middle: number; lower: number } | null;
  macd: {
    macd: number;
    signal: number;
    histogram: number;
    crossover: 1 | -1 | 0;
  } | null;
  sma200d: number | null; // 200-day Simple Moving Average

  // Advanced indicators
  obv: { value: number; trend: TrendDirection } | null;
  atr14d: number | null; // Average True Range (14d) in GP
  vwap: number | null; // Volume-Weighted Average Price
  fibonacci: {
    swingHigh: number;
    swingLow: number;
    direction: 'uptrend' | 'downtrend';
    levels: { ratio: number; price: number }[];
  } | null;

  // Seasonal patterns (if enough data)
  seasonalPatterns: SeasonalPattern[];

  // Manipulation risk assessment (0-100, higher = more suspicious)
  manipulationRisk: number;

  // Key price levels
  priceLevels: PriceLevel[];

  // Generated insights
  insights: MarketInsight[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MONTH_NAMES = [
  '',
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const squareDiffs = values.map((v) => (v - avg) ** 2);
  return Math.sqrt(mean(squareDiffs));
}

/**
 * Simple linear regression. Returns slope (change per unit) and r-squared.
 */
function linearRegression(values: number[]): {
  slope: number;
  rSquared: number;
} {
  const n = values.length;
  if (n < 2) return { slope: 0, rSquared: 0 };

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  let sumYY = 0;

  for (let i = 0; i < n; i++) {
    const x = i;
    const y = values[i]!;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
    sumYY += y * y;
  }

  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return { slope: 0, rSquared: 0 };

  const slope = (n * sumXY - sumX * sumY) / denom;

  // R-squared
  const ssTot = sumYY - (sumY * sumY) / n;
  const ssRes = ssTot - slope * (sumXY - (sumX * sumY) / n);
  const rSquared = ssTot !== 0 ? 1 - ssRes / ssTot : 0;

  return { slope, rSquared: Math.max(0, Math.min(1, rSquared)) };
}

function classifyTrend(
  changePercent: number,
  rSquared: number
): { direction: TrendDirection; confidence: Confidence } {
  const absChange = Math.abs(changePercent);

  let direction: TrendDirection;
  if (absChange < 2) direction = 'stable';
  else if (changePercent > 0) direction = 'rising';
  else direction = 'falling';

  let confidence: Confidence;
  if (rSquared > 0.7 && absChange > 5) confidence = 'high';
  else if (rSquared > 0.4 && absChange > 2) confidence = 'medium';
  else confidence = 'low';

  return { direction, confidence };
}

// ---------------------------------------------------------------------------
// Core analysis
// ---------------------------------------------------------------------------

/**
 * Compute a price trend over a set of daily summaries.
 */
export function computePriceTrend(
  summaries: GeDailySummary[],
  periodLabel: string
): PriceTrend | null {
  const prices = summaries
    .map((s) => s.avgBuyPrice)
    .filter((p): p is number => p !== null);

  if (prices.length < 3) return null;

  const { slope, rSquared } = linearRegression(prices);
  const startPrice = prices[0]!;
  const endPrice = prices[prices.length - 1]!;
  const changePercent =
    startPrice > 0 ? ((endPrice - startPrice) / startPrice) * 100 : 0;

  const { direction, confidence } = classifyTrend(changePercent, rSquared);

  // Ignore slope if it's effectively zero to avoid returning misleading data
  void slope;

  return { direction, changePercent, period: periodLabel, confidence };
}

/**
 * Compute a volume trend.
 */
export function computeVolumeTrend(
  summaries: GeDailySummary[],
  periodLabel: string
): VolumeTrend | null {
  const volumes = summaries
    .map((s) => s.totalVolume)
    .filter((v): v is number => v !== null);

  if (volumes.length < 3) return null;

  const avgVolume = mean(volumes);
  // Compare last third of data to the full average
  const recentThird = volumes.slice(Math.floor(volumes.length * 0.67));
  const recentAvgVolume = mean(recentThird);

  const changePercent =
    avgVolume > 0 ? ((recentAvgVolume - avgVolume) / avgVolume) * 100 : 0;

  let direction: TrendDirection;
  if (Math.abs(changePercent) < 10) direction = 'stable';
  else if (changePercent > 0) direction = 'rising';
  else direction = 'falling';

  return {
    direction,
    changePercent,
    period: periodLabel,
    avgVolume: Math.round(avgVolume),
    recentAvgVolume: Math.round(recentAvgVolume),
  };
}

/**
 * Detect seasonal patterns from daily summaries (needs months of data).
 * Groups data by calendar month and computes average price changes.
 */
export function detectSeasonalPatterns(
  summaries: GeDailySummary[]
): SeasonalPattern[] {
  if (summaries.length < 60) return []; // Need at least ~2 months

  // Group by month
  const monthBuckets: Map<number, { prices: number[]; volumes: number[] }> =
    new Map();

  for (const s of summaries) {
    if (s.avgBuyPrice === null) continue;
    const month = new Date(s.date).getUTCMonth() + 1; // 1-12
    if (!monthBuckets.has(month)) {
      monthBuckets.set(month, { prices: [], volumes: [] });
    }
    const bucket = monthBuckets.get(month)!;
    bucket.prices.push(s.avgBuyPrice);
    if (s.totalVolume !== null) bucket.volumes.push(s.totalVolume);
  }

  const overallAvgPrice = mean(
    summaries.map((s) => s.avgBuyPrice).filter((p): p is number => p !== null)
  );
  const overallAvgVolume = mean(
    summaries.map((s) => s.totalVolume).filter((v): v is number => v !== null)
  );

  if (overallAvgPrice === 0) return [];

  const patterns: SeasonalPattern[] = [];

  for (const [month, bucket] of monthBuckets) {
    if (bucket.prices.length < 5) continue; // Need enough samples

    const monthAvgPrice = mean(bucket.prices);
    const monthAvgVolume = bucket.volumes.length > 0 ? mean(bucket.volumes) : 0;

    const avgPriceChange =
      ((monthAvgPrice - overallAvgPrice) / overallAvgPrice) * 100;
    const avgVolumeChange =
      overallAvgVolume > 0
        ? ((monthAvgVolume - overallAvgVolume) / overallAvgVolume) * 100
        : 0;

    // Rough estimate of how many "years" contributed
    const uniqueYears = new Set(
      summaries
        .filter(
          (s) =>
            s.avgBuyPrice !== null &&
            new Date(s.date).getUTCMonth() + 1 === month
        )
        .map((s) => new Date(s.date).getUTCFullYear())
    ).size;

    let confidence: Confidence;
    if (uniqueYears >= 2 && Math.abs(avgPriceChange) > 5) confidence = 'high';
    else if (bucket.prices.length >= 10) confidence = 'medium';
    else confidence = 'low';

    patterns.push({
      month,
      monthName: MONTH_NAMES[month]!,
      avgPriceChange: Math.round(avgPriceChange * 100) / 100,
      avgVolumeChange: Math.round(avgVolumeChange * 100) / 100,
      sampleSize: uniqueYears,
      confidence,
    });
  }

  return patterns.sort((a, b) => a.month - b.month);
}

/**
 * Find support and resistance price levels from historical data.
 */
export function findPriceLevels(
  summaries: GeDailySummary[],
  bucketCount: number = 20
): PriceLevel[] {
  const prices: number[] = [];
  for (const s of summaries) {
    if (s.highBuyPrice !== null) prices.push(s.highBuyPrice);
    if (s.lowBuyPrice !== null) prices.push(s.lowBuyPrice);
    if (s.highSellPrice !== null) prices.push(s.highSellPrice);
    if (s.lowSellPrice !== null) prices.push(s.lowSellPrice);
  }

  if (prices.length < 10) return [];

  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const range = maxPrice - minPrice;
  if (range <= 0) return [];

  // Create price buckets and count how often prices cluster
  const bucketSize = range / bucketCount;
  const histogram = new Array<number>(bucketCount).fill(0);

  for (const price of prices) {
    const idx = Math.min(
      Math.floor((price - minPrice) / bucketSize),
      bucketCount - 1
    );
    histogram[idx]!++;
  }

  // Find peaks in the histogram (local maxima)
  const levels: PriceLevel[] = [];
  const maxCount = Math.max(...histogram);

  for (let i = 1; i < histogram.length - 1; i++) {
    const count = histogram[i]!;
    const prev = histogram[i - 1]!;
    const next = histogram[i + 1]!;

    // Is this a local maximum with significant count?
    if (count > prev && count > next && count > maxCount * 0.3) {
      const price = Math.round(minPrice + (i + 0.5) * bucketSize);
      const strength = Math.round((count / maxCount) * 100);

      // If the current market price is above this level, it's support
      // If below, it's resistance. Use the latest summary price.
      const latestPrice = summaries[summaries.length - 1]?.avgBuyPrice;
      const type =
        latestPrice !== null && latestPrice !== undefined && price < latestPrice
          ? 'support'
          : 'resistance';

      levels.push({ type, price, strength });
    }
  }

  return levels.sort((a, b) => b.strength - a.strength).slice(0, 5);
}

// ---------------------------------------------------------------------------
// Technical Indicators
// ---------------------------------------------------------------------------

/**
 * Exponential Moving Average. Used by RSI and MACD.
 * @param values - Price series (oldest first)
 * @param period - Smoothing period
 */
export function computeEMA(values: number[], period: number): number[] {
  if (values.length === 0) return [];
  const k = 2 / (period + 1);
  const ema: number[] = [values[0]!];

  for (let i = 1; i < values.length; i++) {
    ema.push(values[i]! * k + ema[i - 1]! * (1 - k));
  }
  return ema;
}

/**
 * Simple Moving Average over the last `period` values.
 */
export function computeSMA(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

/**
 * Relative Strength Index (RSI).
 *
 * Uses the standard Wilder smoothing method:
 * 1. Compute gains/losses for each period
 * 2. First avg is simple mean over `period`
 * 3. Subsequent avgs use exponential smoothing: prev*(period-1)/period + current/period
 *
 * @param prices - Daily close prices (oldest first), minimum period+1 values
 * @param period - RSI period (default 14)
 * @returns RSI value 0-100, or null if insufficient data
 */
export function computeRSI(
  prices: number[],
  period: number = 14
): number | null {
  if (prices.length < period + 1) return null;

  const gains: number[] = [];
  const losses: number[] = [];

  for (let i = 1; i < prices.length; i++) {
    const change = prices[i]! - prices[i - 1]!;
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);
  }

  // First average: simple mean over `period`
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

  // Smooth the remaining data
  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]!) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]!) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Math.round((100 - 100 / (1 + rs)) * 100) / 100;
}

/**
 * Bollinger Bands (20-day SMA ± 2 standard deviations).
 *
 * @returns { upper, middle, lower } or null if insufficient data
 */
export function computeBollingerBands(
  prices: number[],
  period: number = 20,
  multiplier: number = 2
): { upper: number; middle: number; lower: number } | null {
  if (prices.length < period) return null;

  const slice = prices.slice(-period);
  const middle = slice.reduce((a, b) => a + b, 0) / period;
  const sd = stddev(slice);

  return {
    upper: Math.round((middle + multiplier * sd) * 100) / 100,
    middle: Math.round(middle * 100) / 100,
    lower: Math.round((middle - multiplier * sd) * 100) / 100,
  };
}

/**
 * MACD (Moving Average Convergence Divergence).
 *
 * Standard parameters: 12-day EMA, 26-day EMA, 9-day signal line.
 * Returns the MACD line, signal line, and histogram (MACD - signal).
 * A bullish crossover is when MACD crosses above signal; bearish is the reverse.
 *
 * @returns { macd, signal, histogram, crossover: 1 | -1 | 0 } or null
 */
export function computeMACD(
  prices: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): {
  macd: number;
  signal: number;
  histogram: number;
  crossover: 1 | -1 | 0;
} | null {
  if (prices.length < slowPeriod + signalPeriod) return null;

  const fastEMA = computeEMA(prices, fastPeriod);
  const slowEMA = computeEMA(prices, slowPeriod);

  // MACD line = fast EMA - slow EMA
  const macdLine: number[] = [];
  for (let i = 0; i < prices.length; i++) {
    macdLine.push(fastEMA[i]! - slowEMA[i]!);
  }

  // Signal line = EMA of MACD line
  const signalLine = computeEMA(macdLine, signalPeriod);

  const current = macdLine.length - 1;
  const prev = current - 1;

  const macd = macdLine[current]!;
  const signal = signalLine[current]!;
  const histogram = macd - signal;

  // Detect crossover (MACD crossing signal line)
  let crossover: 1 | -1 | 0 = 0;
  if (prev >= 0) {
    const prevMacd = macdLine[prev]!;
    const prevSignal = signalLine[prev]!;
    if (prevMacd <= prevSignal && macd > signal)
      crossover = 1; // Bullish
    else if (prevMacd >= prevSignal && macd < signal) crossover = -1; // Bearish
  }

  return {
    macd: Math.round(macd * 100) / 100,
    signal: Math.round(signal * 100) / 100,
    histogram: Math.round(histogram * 100) / 100,
    crossover,
  };
}

/**
 * Compute all technical indicators for an item given daily prices.
 * This is a convenience function used by the cron to populate HistoricalContext.
 */
export function computeTechnicalIndicators(prices: number[]): {
  rsi14d: number | null;
  bollingerBands: { upper: number; middle: number; lower: number } | null;
  macd: {
    macd: number;
    signal: number;
    histogram: number;
    crossover: 1 | -1 | 0;
  } | null;
  sma200d: number | null;
} {
  return {
    rsi14d: computeRSI(prices, 14),
    bollingerBands: computeBollingerBands(prices, 20, 2),
    macd: computeMACD(prices),
    sma200d: computeSMA(prices, 200),
  };
}

// ---------------------------------------------------------------------------
// Advanced Technical Indicators
// ---------------------------------------------------------------------------

/**
 * On-Balance Volume (OBV).
 *
 * Cumulative volume indicator: adds volume on up-days, subtracts on down-days.
 * Shows whether volume confirms or diverges from price trends.
 *
 * @param prices - Daily close prices (oldest first)
 * @param volumes - Corresponding daily volumes
 * @returns Final OBV value and trend direction, or null if insufficient data
 */
export function computeOBV(
  prices: number[],
  volumes: number[]
): { value: number; trend: TrendDirection } | null {
  const len = Math.min(prices.length, volumes.length);
  if (len < 3) return null;

  let obv = 0;
  const obvSeries: number[] = [0];

  for (let i = 1; i < len; i++) {
    if (prices[i]! > prices[i - 1]!) {
      obv += volumes[i]!;
    } else if (prices[i]! < prices[i - 1]!) {
      obv -= volumes[i]!;
    }
    // If prices are equal, OBV stays the same
    obvSeries.push(obv);
  }

  // Determine OBV trend from recent third
  const recentThird = obvSeries.slice(Math.floor(len * 0.67));
  const firstRecent = recentThird[0]!;
  const lastRecent = recentThird[recentThird.length - 1]!;
  const change =
    firstRecent !== 0
      ? ((lastRecent - firstRecent) / Math.abs(firstRecent)) * 100
      : lastRecent > 0
        ? 100
        : lastRecent < 0
          ? -100
          : 0;

  let trend: TrendDirection;
  if (Math.abs(change) < 10) trend = 'stable';
  else if (change > 0) trend = 'rising';
  else trend = 'falling';

  return { value: obv, trend };
}

/**
 * Average True Range (ATR).
 *
 * Measures average volatility in absolute GP terms over N periods.
 * Uses daily high/low/close data.
 *
 * True Range = max(high-low, |high-prevClose|, |low-prevClose|)
 * ATR = SMA of True Range over `period` days
 *
 * @param highs - Daily high prices
 * @param lows - Daily low prices
 * @param closes - Daily close prices
 * @param period - ATR period (default 14)
 */
export function computeATR(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 14
): number | null {
  const len = Math.min(highs.length, lows.length, closes.length);
  if (len < period + 1) return null;

  const trueRanges: number[] = [];
  for (let i = 1; i < len; i++) {
    const tr = Math.max(
      highs[i]! - lows[i]!,
      Math.abs(highs[i]! - closes[i - 1]!),
      Math.abs(lows[i]! - closes[i - 1]!)
    );
    trueRanges.push(tr);
  }

  // Simple average of last `period` true ranges
  const recent = trueRanges.slice(-period);
  return (
    Math.round((recent.reduce((a, b) => a + b, 0) / recent.length) * 100) / 100
  );
}

/**
 * Volume-Weighted Average Price (VWAP).
 *
 * More accurate "fair price" than simple average — weights each price
 * by its trading volume.
 *
 * VWAP = sum(price * volume) / sum(volume)
 *
 * @param prices - Daily average prices
 * @param volumes - Corresponding daily volumes
 */
export function computeVWAP(
  prices: number[],
  volumes: number[]
): number | null {
  const len = Math.min(prices.length, volumes.length);
  if (len === 0) return null;

  let sumPV = 0;
  let sumV = 0;

  for (let i = 0; i < len; i++) {
    sumPV += prices[i]! * volumes[i]!;
    sumV += volumes[i]!;
  }

  if (sumV === 0) return null;
  return Math.round((sumPV / sumV) * 100) / 100;
}

/**
 * Fibonacci Retracement Levels.
 *
 * After a significant price move, prices tend to retrace to key Fibonacci
 * levels: 23.6%, 38.2%, 50%, 61.8%, 78.6%.
 *
 * Finds the most recent significant swing (highest high to lowest low or vice
 * versa) and computes retracement levels.
 *
 * @param prices - Daily close prices (oldest first)
 * @returns Fibonacci levels and the swing direction, or null if range is too small
 */
export function computeFibonacciLevels(prices: number[]): {
  swingHigh: number;
  swingLow: number;
  direction: 'uptrend' | 'downtrend';
  levels: { ratio: number; price: number }[];
} | null {
  if (prices.length < 10) return null;

  const swingHigh = Math.max(...prices);
  const swingLow = Math.min(...prices);
  const range = swingHigh - swingLow;

  // Need a meaningful range (at least 3% of the low price)
  if (swingLow <= 0 || range / swingLow < 0.03) return null;

  // Determine direction: is the most recent price closer to the high or low?
  const lastPrice = prices[prices.length - 1]!;
  const highIdx = prices.lastIndexOf(swingHigh);
  const lowIdx = prices.lastIndexOf(swingLow);
  const direction = highIdx > lowIdx ? 'uptrend' : 'downtrend';

  const FIB_RATIOS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

  const levels = FIB_RATIOS.map((ratio) => ({
    ratio,
    price: Math.round(
      direction === 'uptrend'
        ? swingHigh - range * ratio // retracement from high
        : swingLow + range * ratio // extension from low
    ),
  }));

  void lastPrice; // used only for direction detection above

  return { swingHigh, swingLow, direction, levels };
}

// ---------------------------------------------------------------------------
// Manipulation Detection
// ---------------------------------------------------------------------------

/**
 * Compute a manipulation risk score (0-100) based on multiple signals:
 *
 * 1. **4x4 Rule**: Price moved 4%+ on 4 of the last 5 days (used by GE Central)
 * 2. **Volume spike on low-volume item**: Sudden volume burst on normally quiet items
 * 3. **Price-volume divergence**: Price spiking while volume is normal or declining
 * 4. **Extreme single-day moves**: Individual days with >10% price change
 *
 * Returns 0-100 where:
 *   0-20  = very low risk
 *   21-40 = low risk
 *   41-60 = moderate risk (some suspicious patterns)
 *   61-80 = high risk (multiple manipulation signals)
 *   81-100 = very high risk (classic pump-and-dump pattern)
 */
export function computeManipulationRisk(summaries: GeDailySummary[]): number {
  if (summaries.length < 5) return 0;

  const sorted = [...summaries].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const prices = sorted
    .map((s) => s.avgBuyPrice)
    .filter((p): p is number => p !== null);
  const volumes = sorted
    .map((s) => s.totalVolume)
    .filter((v): v is number => v !== null);

  if (prices.length < 5) return 0;

  let risk = 0;

  // --- Signal 1: 4x4 Rule ---
  // Count days in the last 5 where price changed 4%+
  const recent5 = prices.slice(-6); // need 6 to compute 5 daily changes
  if (recent5.length >= 6) {
    let bigMoveDays = 0;
    for (let i = 1; i < recent5.length; i++) {
      const pctChange =
        Math.abs((recent5[i]! - recent5[i - 1]!) / recent5[i - 1]!) * 100;
      if (pctChange >= 4) bigMoveDays++;
    }
    if (bigMoveDays >= 4)
      risk += 35; // Classic 4x4 pattern
    else if (bigMoveDays >= 3) risk += 20;
    else if (bigMoveDays >= 2) risk += 10;
  }

  // --- Signal 2: Volume spike on normally quiet item ---
  if (volumes.length >= 10) {
    const avgVolume = mean(volumes.slice(0, -3)); // Baseline excluding last 3 days
    const recentVolume = mean(volumes.slice(-3));
    if (avgVolume > 0 && avgVolume < 200) {
      // Low-volume item
      const volumeRatio = recentVolume / avgVolume;
      if (volumeRatio > 5) risk += 25;
      else if (volumeRatio > 3) risk += 15;
    }
  }

  // --- Signal 3: Extreme single-day price moves ---
  const recentPrices = prices.slice(-7);
  for (let i = 1; i < recentPrices.length; i++) {
    const pctChange =
      Math.abs(
        (recentPrices[i]! - recentPrices[i - 1]!) / recentPrices[i - 1]!
      ) * 100;
    if (pctChange > 15) {
      risk += 20;
      break; // Only count once
    } else if (pctChange > 10) {
      risk += 10;
      break;
    }
  }

  // --- Signal 4: Price-volume divergence ---
  // Price spiking up while volume is declining → suspicious
  if (prices.length >= 7 && volumes.length >= 7) {
    const priceTrend = prices[prices.length - 1]! - prices[prices.length - 7]!;
    const priceChange =
      prices[prices.length - 7]! !== 0
        ? (priceTrend / prices[prices.length - 7]!) * 100
        : 0;

    const volRecent = mean(volumes.slice(-3));
    const volPrev = mean(volumes.slice(-7, -3));
    const volChange = volPrev > 0 ? ((volRecent - volPrev) / volPrev) * 100 : 0;

    // Price up 10%+ but volume down 20%+ → divergence
    if (priceChange > 10 && volChange < -20) risk += 15;
  }

  return Math.min(100, risk);
}

// ---------------------------------------------------------------------------
// Insight generation
// ---------------------------------------------------------------------------

/**
 * Generate actionable market insights from analysis results.
 */
export function generateInsights(
  analysis: Omit<ItemMarketAnalysis, 'insights'>
): MarketInsight[] {
  const insights: MarketInsight[] = [];

  // Price vs historical average
  if (analysis.priceVsAvg30d !== null && analysis.priceVsAvg30d < -15) {
    insights.push({
      type: 'buy-signal',
      title: 'Price below 30-day average',
      description: `Currently ${Math.abs(analysis.priceVsAvg30d).toFixed(1)}% below the 30-day average price. Historically this can indicate a buying opportunity if the item is not in a long-term decline.`,
      confidence: Math.abs(analysis.priceVsAvg30d) > 25 ? 'high' : 'medium',
    });
  }

  if (analysis.priceVsAvg30d !== null && analysis.priceVsAvg30d > 20) {
    insights.push({
      type: 'sell-signal',
      title: 'Price above 30-day average',
      description: `Currently ${analysis.priceVsAvg30d.toFixed(1)}% above the 30-day average. Consider selling if you're holding — the price may revert toward the mean.`,
      confidence: analysis.priceVsAvg30d > 35 ? 'high' : 'medium',
    });
  }

  // Trend alerts
  if (
    analysis.priceTrend7d?.direction === 'rising' &&
    analysis.priceTrend7d.confidence !== 'low'
  ) {
    insights.push({
      type: 'trend-alert',
      title: 'Short-term uptrend',
      description: `Price has risen ${analysis.priceTrend7d.changePercent.toFixed(1)}% over the past week. Momentum is currently positive.`,
      confidence: analysis.priceTrend7d.confidence,
    });
  }

  if (
    analysis.priceTrend7d?.direction === 'falling' &&
    analysis.priceTrend7d.confidence !== 'low'
  ) {
    insights.push({
      type: 'trend-alert',
      title: 'Short-term downtrend',
      description: `Price has dropped ${Math.abs(analysis.priceTrend7d.changePercent).toFixed(1)}% over the past week. Consider waiting for stabilization before buying.`,
      confidence: analysis.priceTrend7d.confidence,
    });
  }

  // Conflicting short/long trends
  if (
    analysis.priceTrend7d &&
    analysis.priceTrend30d &&
    analysis.priceTrend7d.direction !== analysis.priceTrend30d.direction &&
    analysis.priceTrend7d.direction !== 'stable' &&
    analysis.priceTrend30d.direction !== 'stable'
  ) {
    insights.push({
      type: 'info',
      title: 'Trend reversal signal',
      description: `The 7-day trend is ${analysis.priceTrend7d.direction} but the 30-day trend is ${analysis.priceTrend30d.direction}. This divergence can signal a trend reversal — watch closely.`,
      confidence: 'medium',
    });
  }

  // Volume alerts
  if (
    analysis.volumeTrend?.direction === 'falling' &&
    analysis.volumeTrend.changePercent < -30
  ) {
    insights.push({
      type: 'volume-alert',
      title: 'Declining trading volume',
      description: `Volume has dropped ${Math.abs(analysis.volumeTrend.changePercent).toFixed(0)}% compared to the period average. Lower liquidity means wider spreads and harder fills.`,
      confidence:
        Math.abs(analysis.volumeTrend.changePercent) > 50 ? 'high' : 'medium',
    });
  }

  if (
    analysis.volumeTrend?.direction === 'rising' &&
    analysis.volumeTrend.changePercent > 50
  ) {
    insights.push({
      type: 'volume-alert',
      title: 'Volume spike detected',
      description: `Recent volume is ${analysis.volumeTrend.changePercent.toFixed(0)}% above the period average. This could indicate increased interest or active manipulation — check the price trend.`,
      confidence: analysis.volumeTrend.changePercent > 100 ? 'high' : 'medium',
    });
  }

  // High volatility warning
  if (
    analysis.priceVolatility30d !== null &&
    analysis.priceVolatility30d > 20
  ) {
    insights.push({
      type: 'manipulation-warning',
      title: 'High price volatility',
      description: `This item has ${analysis.priceVolatility30d.toFixed(1)}% price volatility over the past 30 days. High volatility means higher risk — spreads can shift rapidly.`,
      confidence: analysis.priceVolatility30d > 35 ? 'high' : 'medium',
    });
  }

  // Seasonal patterns
  const currentMonth = new Date().getUTCMonth() + 1;
  const currentSeason = analysis.seasonalPatterns.find(
    (p) => p.month === currentMonth
  );
  if (currentSeason && currentSeason.confidence !== 'low') {
    if (Math.abs(currentSeason.avgPriceChange) > 5) {
      const direction = currentSeason.avgPriceChange > 0 ? 'rise' : 'drop';
      insights.push({
        type: 'seasonal-pattern',
        title: `Seasonal ${direction} in ${currentSeason.monthName}`,
        description: `Historically, this item tends to ${direction} about ${Math.abs(currentSeason.avgPriceChange).toFixed(1)}% during ${currentSeason.monthName} (based on ${currentSeason.sampleSize} year${currentSeason.sampleSize > 1 ? 's' : ''} of data).`,
        confidence: currentSeason.confidence,
      });
    }
  }

  // Look ahead — next month's pattern
  const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
  const nextSeason = analysis.seasonalPatterns.find(
    (p) => p.month === nextMonth
  );
  if (
    nextSeason &&
    nextSeason.confidence !== 'low' &&
    Math.abs(nextSeason.avgPriceChange) > 8
  ) {
    const direction = nextSeason.avgPriceChange > 0 ? 'rise' : 'drop';
    insights.push({
      type: 'seasonal-pattern',
      title: `Upcoming seasonal ${direction}`,
      description: `Next month (${nextSeason.monthName}), this item historically tends to ${direction} about ${Math.abs(nextSeason.avgPriceChange).toFixed(1)}%. Plan accordingly.`,
      confidence: nextSeason.confidence,
    });
  }

  // --- Technical indicator insights ---

  // RSI extremes
  if (analysis.rsi14d !== null) {
    if (analysis.rsi14d < 25) {
      insights.push({
        type: 'buy-signal',
        title: 'RSI indicates oversold',
        description: `The 14-day RSI is at ${analysis.rsi14d.toFixed(0)}, which is in deeply oversold territory. This often precedes a price recovery as selling pressure exhausts itself.`,
        confidence: analysis.rsi14d < 20 ? 'high' : 'medium',
      });
    } else if (analysis.rsi14d > 75) {
      insights.push({
        type: 'sell-signal',
        title: 'RSI indicates overbought',
        description: `The 14-day RSI is at ${analysis.rsi14d.toFixed(0)}, which is in overbought territory. Prices may pull back as buying pressure fades.`,
        confidence: analysis.rsi14d > 80 ? 'high' : 'medium',
      });
    }
  }

  // Bollinger Band breach
  if (analysis.bollingerBands && analysis.currentPrice !== null) {
    if (analysis.currentPrice < analysis.bollingerBands.lower) {
      const pctBelow =
        ((analysis.bollingerBands.lower - analysis.currentPrice) /
          analysis.bollingerBands.lower) *
        100;
      insights.push({
        type: 'buy-signal',
        title: 'Below lower Bollinger Band',
        description: `Price is ${pctBelow.toFixed(1)}% below the lower Bollinger Band (20-day, 2σ). This is a statistically rare event that often signals a reversal back toward the mean.`,
        confidence: pctBelow > 5 ? 'high' : 'medium',
      });
    } else if (analysis.currentPrice > analysis.bollingerBands.upper) {
      insights.push({
        type: 'sell-signal',
        title: 'Above upper Bollinger Band',
        description: `Price has broken above the upper Bollinger Band — a sign of extended overbought conditions. Consider taking profits.`,
        confidence: 'medium',
      });
    }
  }

  // MACD crossover
  if (analysis.macd) {
    if (analysis.macd.crossover === 1) {
      insights.push({
        type: 'buy-signal',
        title: 'MACD bullish crossover',
        description: `The MACD line has crossed above the signal line, indicating a shift in momentum from bearish to bullish. This is a classic entry signal.`,
        confidence: Math.abs(analysis.macd.histogram) > 1 ? 'high' : 'medium',
      });
    } else if (analysis.macd.crossover === -1) {
      insights.push({
        type: 'sell-signal',
        title: 'MACD bearish crossover',
        description: `The MACD line has crossed below the signal line. Momentum is shifting bearish — consider reducing exposure.`,
        confidence: Math.abs(analysis.macd.histogram) > 1 ? 'high' : 'medium',
      });
    }
  }

  // Price vs 200-day SMA (long-term trend indicator)
  if (analysis.sma200d !== null && analysis.currentPrice !== null) {
    const pctVsSma =
      ((analysis.currentPrice - analysis.sma200d) / analysis.sma200d) * 100;
    if (pctVsSma < -15) {
      insights.push({
        type: 'buy-signal',
        title: 'Well below 200-day moving average',
        description: `Price is ${Math.abs(pctVsSma).toFixed(0)}% below the 200-day SMA — a key long-term support indicator. Items this far below their long-term average have historically tended to recover.`,
        confidence: pctVsSma < -25 ? 'high' : 'medium',
      });
    } else if (pctVsSma > 30) {
      insights.push({
        type: 'sell-signal',
        title: 'Extended above 200-day moving average',
        description: `Price is ${pctVsSma.toFixed(0)}% above the 200-day SMA. While the long-term trend is strong, this level of extension often sees pullbacks.`,
        confidence: 'medium',
      });
    }
  }

  // Long-term price context (365d)
  if (
    analysis.priceVsAvg365d !== null &&
    Math.abs(analysis.priceVsAvg365d) > 20
  ) {
    if (analysis.priceVsAvg365d < -20) {
      insights.push({
        type: 'info',
        title: 'Below yearly average',
        description: `Price is ${Math.abs(analysis.priceVsAvg365d).toFixed(0)}% below the yearly average of ${analysis.avgPrice365d?.toLocaleString() ?? '?'} gp. This may represent a long-term buying opportunity or a structural decline.`,
        confidence: Math.abs(analysis.priceVsAvg365d) > 30 ? 'high' : 'medium',
      });
    } else if (analysis.priceVsAvg365d > 20) {
      insights.push({
        type: 'info',
        title: 'Above yearly average',
        description: `Price is ${analysis.priceVsAvg365d.toFixed(0)}% above the yearly average. Evaluate whether the premium is justified by recent game updates or events.`,
        confidence: 'medium',
      });
    }
  }

  // Manipulation risk warning
  if (analysis.manipulationRisk >= 60) {
    insights.push({
      type: 'manipulation-warning',
      title: 'High manipulation risk',
      description: `This item has a manipulation risk score of ${analysis.manipulationRisk}/100. Multiple suspicious patterns detected — exercise extreme caution.`,
      confidence: analysis.manipulationRisk >= 80 ? 'high' : 'medium',
    });
  } else if (analysis.manipulationRisk >= 40) {
    insights.push({
      type: 'manipulation-warning',
      title: 'Moderate manipulation risk',
      description: `Some suspicious trading patterns detected (risk score: ${analysis.manipulationRisk}/100). Verify with your own margin checks before committing large amounts.`,
      confidence: 'low',
    });
  }

  // OBV divergence: price rising but OBV falling (or vice versa) = warning
  if (analysis.obv && analysis.priceTrend30d) {
    if (
      analysis.priceTrend30d.direction === 'rising' &&
      analysis.obv.trend === 'falling'
    ) {
      insights.push({
        type: 'sell-signal',
        title: 'OBV bearish divergence',
        description:
          'Price is rising but On-Balance Volume is falling — selling pressure is increasing beneath the surface. This often precedes a price reversal.',
        confidence: 'medium',
      });
    } else if (
      analysis.priceTrend30d.direction === 'falling' &&
      analysis.obv.trend === 'rising'
    ) {
      insights.push({
        type: 'buy-signal',
        title: 'OBV bullish divergence',
        description:
          'Price is falling but On-Balance Volume is rising — accumulation is happening. This can signal a bottom and upcoming reversal.',
        confidence: 'medium',
      });
    }
  }

  // VWAP deviation: price far from volume-weighted fair value
  if (
    analysis.vwap !== null &&
    analysis.currentPrice !== null &&
    analysis.vwap > 0
  ) {
    const pctFromVwap =
      ((analysis.currentPrice - analysis.vwap) / analysis.vwap) * 100;
    if (pctFromVwap < -15) {
      insights.push({
        type: 'buy-signal',
        title: 'Below VWAP',
        description: `Price is ${Math.abs(pctFromVwap).toFixed(0)}% below the Volume-Weighted Average Price. The "smart money" price is higher, suggesting undervaluation.`,
        confidence: Math.abs(pctFromVwap) > 25 ? 'high' : 'medium',
      });
    } else if (pctFromVwap > 20) {
      insights.push({
        type: 'sell-signal',
        title: 'Above VWAP',
        description: `Price is ${pctFromVwap.toFixed(0)}% above VWAP. Most volume occurred at lower prices — current price may be stretched.`,
        confidence: 'medium',
      });
    }
  }

  return insights;
}

// ---------------------------------------------------------------------------
// Main analysis function
// ---------------------------------------------------------------------------

/**
 * Run full market analysis on an item given its daily summaries and current price.
 * This is the main entry point — call with data from getItemDailySummaries().
 */
export function analyzeItemMarket(
  itemId: number,
  summaries: GeDailySummary[],
  currentPrice: number | null
): ItemMarketAnalysis {
  const dataPoints = summaries.length;

  // Calculate data span
  let dataSpanDays = 0;
  if (summaries.length >= 2) {
    const first = new Date(summaries[0]!.date).getTime();
    const last = new Date(summaries[summaries.length - 1]!.date).getTime();
    dataSpanDays = Math.round((last - first) / (1000 * 60 * 60 * 24));
  }

  // Split summaries into time windows
  const now = new Date();
  const d7ago = new Date(now);
  d7ago.setUTCDate(d7ago.getUTCDate() - 7);
  const d30ago = new Date(now);
  d30ago.setUTCDate(d30ago.getUTCDate() - 30);
  const d90ago = new Date(now);
  d90ago.setUTCDate(d90ago.getUTCDate() - 90);

  const last7d = summaries.filter((s) => new Date(s.date) >= d7ago);
  const last30d = summaries.filter((s) => new Date(s.date) >= d30ago);
  const last90d = summaries.filter((s) => new Date(s.date) >= d90ago);

  // Average prices
  const prices30d = last30d
    .map((s) => s.avgBuyPrice)
    .filter((p): p is number => p !== null);
  const prices90d = last90d
    .map((s) => s.avgBuyPrice)
    .filter((p): p is number => p !== null);

  const avgPrice30d = prices30d.length > 0 ? Math.round(mean(prices30d)) : null;
  const avgPrice90d = prices90d.length > 0 ? Math.round(mean(prices90d)) : null;

  const priceVsAvg30d =
    currentPrice !== null && avgPrice30d !== null && avgPrice30d > 0
      ? Math.round(((currentPrice - avgPrice30d) / avgPrice30d) * 1000) / 10
      : null;
  const priceVsAvg90d =
    currentPrice !== null && avgPrice90d !== null && avgPrice90d > 0
      ? Math.round(((currentPrice - avgPrice90d) / avgPrice90d) * 1000) / 10
      : null;

  // Trends
  const priceTrend7d = computePriceTrend(last7d, '7d');
  const priceTrend30d = computePriceTrend(last30d, '30d');
  const volumeTrend = computeVolumeTrend(last30d, '30d');

  // Volatility (coefficient of variation over 30 days)
  const priceVolatility30d =
    prices30d.length >= 5
      ? Math.round((stddev(prices30d) / mean(prices30d)) * 1000) / 10
      : null;

  // 365-day (all available data) price context
  const pricesAll = summaries
    .map((s) => s.avgBuyPrice)
    .filter((p): p is number => p !== null);
  const avgPrice365d =
    pricesAll.length > 0 ? Math.round(mean(pricesAll)) : null;
  const priceVsAvg365d =
    currentPrice !== null && avgPrice365d !== null && avgPrice365d > 0
      ? Math.round(((currentPrice - avgPrice365d) / avgPrice365d) * 1000) / 10
      : null;

  // Technical indicators (computed from all available price data)
  const indicators = computeTechnicalIndicators(pricesAll);

  // Advanced indicators
  const volumesAll = summaries
    .map((s) => s.totalVolume)
    .filter((v): v is number => v !== null);
  const highsAll = summaries
    .map((s) => s.highBuyPrice)
    .filter((h): h is number => h !== null);
  const lowsAll = summaries
    .map((s) => s.lowBuyPrice)
    .filter((l): l is number => l !== null);

  const obv = computeOBV(pricesAll, volumesAll);
  const atr14d = computeATR(highsAll, lowsAll, pricesAll, 14);
  const vwap = computeVWAP(pricesAll, volumesAll);
  const fibonacci = computeFibonacciLevels(pricesAll);

  // Manipulation risk
  const manipulationRisk = computeManipulationRisk(summaries);

  // Seasonal patterns (use all available data)
  const seasonalPatterns = detectSeasonalPatterns(summaries);

  // Price levels
  const priceLevels = findPriceLevels(
    last90d.length >= 30 ? last90d : summaries
  );

  // Build partial analysis for insight generation
  const partialAnalysis = {
    itemId,
    dataPoints,
    dataSpanDays,
    currentPrice,
    avgPrice30d,
    avgPrice90d,
    priceVsAvg30d,
    priceVsAvg90d,
    priceTrend7d,
    priceTrend30d,
    volumeTrend,
    priceVolatility30d,
    avgPrice365d,
    priceVsAvg365d,
    rsi14d: indicators.rsi14d,
    bollingerBands: indicators.bollingerBands,
    macd: indicators.macd,
    sma200d: indicators.sma200d,
    obv,
    atr14d,
    vwap,
    fibonacci,
    manipulationRisk,
    seasonalPatterns,
    priceLevels,
  };

  const insights = generateInsights(partialAnalysis);

  return { ...partialAnalysis, insights };
}
