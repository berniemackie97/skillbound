/**
 * Flip Quality Scoring Engine
 *
 * Evaluates GE items for flip quality using a composite scoring system.
 * Each item receives a score from 0-100 based on 8 weighted sub-scores,
 * mapped to a letter grade (A-F) with optional warning flags.
 *
 * Sub-scores:
 *   Liquidity (15%)           - How actively traded is this item? (with burst penalty)
 *   Staleness (10%)           - How fresh are the latest buy/sell prices?
 *   Margin Stability (15%)    - Does the live margin match the averaged margin?
 *   Volume Adequacy (10%)     - Can you fill your buy limit in reasonable time?
 *   Buy Pressure (10%)        - Is there more buying or selling activity?
 *   Tax Efficiency (10%)      - How much does GE tax eat into the margin?
 *   Volume Anomaly (15%)      - Detects abnormal volume spikes vs typical patterns
 *   Price Consistency (15%)   - Are live prices consistent with historical averages?
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FlipQualityGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export type FlipQualityFlag =
  | 'stale-prices'
  | 'low-volume'
  | 'unstable-margin'
  | 'high-tax-impact'
  | 'unprofitable-after-tax'
  | 'near-alch-floor'
  | 'thin-market'
  | 'volume-spike'
  | 'price-divergence'
  | 'potential-manipulation'
  | 'historically-unusual';

export interface FlipQualityBreakdown {
  liquidity: number; // 0-100
  staleness: number; // 0-100
  marginStability: number; // 0-100
  volumeAdequacy: number; // 0-100
  buyPressure: number; // 0-100
  taxEfficiency: number; // 0-100
  volumeAnomaly: number; // 0-100
  priceConsistency: number; // 0-100
  historicalReliability: number; // 0-100
}

export interface FlipQualityScore {
  grade: FlipQualityGrade;
  score: number; // 0-100 composite
  breakdown: FlipQualityBreakdown;
  flags: FlipQualityFlag[];
}

/**
 * Input data required to score a single item.
 * This mirrors the fields available on GeExchangeItem after we add
 * the highPriceVolume / lowPriceVolume breakdowns.
 */
export interface FlipScoringInput {
  // Live instant-trade prices
  buyPrice: number | null; // instant buy (high)
  sellPrice: number | null; // instant sell (low)
  buyPriceTime: Date | null;
  sellPriceTime: Date | null;

  // Calculated from live prices
  margin: number | null;
  tax: number | null;

  // 5-minute interval averages
  avgHighPrice5m: number | null;
  avgLowPrice5m: number | null;
  volume5m: number | null;
  highPriceVolume5m: number | null;
  lowPriceVolume5m: number | null;

  // 1-hour interval averages
  avgHighPrice1h: number | null;
  avgLowPrice1h: number | null;
  volume1h: number | null;
  highPriceVolume1h: number | null;
  lowPriceVolume1h: number | null;

  // Item metadata
  buyLimit: number | null;

  // Alchemy price floor (highAlch - nature rune cost).
  // Items near their alch floor have limited downside but also limited
  // mean-reversion potential — "dips" near alch floor aren't real dips.
  alchFloor?: number | null;

  // Optional historical context — populated from persisted market data
  // when available. Without it, historicalReliability defaults to neutral.
  historicalContext?: HistoricalContext | undefined;
}

/**
 * Historical context derived from our persisted market data warehouse.
 * Pre-computed by the cron before scoring — keeps scoring pure & sync.
 *
 * Multi-timeframe: uses 30d, 90d, and 365d windows for comprehensive
 * analysis similar to institutional-grade market tools.
 */
export interface HistoricalContext {
  /** Average buy price over the last 30 days (from daily summaries) */
  avgPrice30d: number | null;
  /** Average daily volume over the last 30 days */
  avgVolume30d: number | null;
  /** Price volatility (coefficient of variation %) over 30 days */
  volatility30d: number | null;
  /** How many daily summary data points are available */
  dataPoints: number;

  // Extended timeframes — null when insufficient data

  /** Average buy price over the last 90 days */
  avgPrice90d?: number | null;
  /** Price volatility over 90 days */
  volatility90d?: number | null;
  /** Average buy price over the last 365 days */
  avgPrice365d?: number | null;
  /** Price volatility over 365 days */
  volatility365d?: number | null;
  /** Average daily volume over 90 days */
  avgVolume90d?: number | null;

  // Technical indicators (optional, computed when enough data)

  /** 14-day Relative Strength Index (0-100) */
  rsi14d?: number | null;
  /** Whether current price is below the lower Bollinger Band (20d, 2σ) */
  belowBollingerLower?: boolean;
  /** Whether current price is above the upper Bollinger Band (20d, 2σ) */
  aboveBollingerUpper?: boolean;
  /** MACD signal: 1 = bullish crossover, -1 = bearish crossover, 0 = neutral */
  macdSignal?: number;
  /** Price relative to 200-day moving average (percent) */
  priceVsSma200d?: number | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Sub-score weights must sum to 1.0 */
const WEIGHTS = {
  liquidity: 0.12,
  staleness: 0.08,
  marginStability: 0.12,
  volumeAdequacy: 0.08,
  buyPressure: 0.08,
  taxEfficiency: 0.08,
  volumeAnomaly: 0.14,
  priceConsistency: 0.14,
  historicalReliability: 0.16,
} as const;

/** Grade thresholds (inclusive lower bound) */
const GRADE_THRESHOLDS: Array<{ min: number; grade: FlipQualityGrade }> = [
  { min: 85, grade: 'A' },
  { min: 70, grade: 'B' },
  { min: 55, grade: 'C' },
  { min: 40, grade: 'D' },
  { min: 0, grade: 'F' },
];

// ---------------------------------------------------------------------------
// Sub-score functions (each returns 0-100)
// ---------------------------------------------------------------------------

/**
 * Liquidity score -- based on combined 1h volume (primary) or 5m volume (fallback).
 *
 * Non-linear scoring with a burst penalty: if 1h volume is decent but 5m volume
 * is nearly zero, the volume likely happened in a burst (not steady trading).
 *
 * Thresholds (1h volume):
 *   1000+ -> 100
 *   500   -> 85
 *   200   -> 70
 *   100   -> 55
 *   50    -> 40
 *   10    -> 25
 *   1     -> 15
 *   0     -> 0
 *
 * Burst penalty: if volume1h >= 100 but volume5m <= 2, apply -20 (floor 0).
 */
function scoreLiquidity(input: FlipScoringInput): number {
  const volume = input.volume1h ?? input.volume5m ?? 0;

  let score: number;
  if (volume <= 0) score = 0;
  else if (volume < 10) score = 15;
  else if (volume < 50) score = 25;
  else if (volume < 100) score = 40;
  else if (volume < 200) score = 55;
  else if (volume < 500) score = 70;
  else if (volume < 1000) score = 85;
  else score = 100;

  // Burst penalty: decent hourly volume but almost nothing in the last 5 minutes
  // suggests the volume happened in a concentrated burst, not steady trading
  const vol1h = input.volume1h ?? 0;
  const vol5m = input.volume5m ?? 0;
  if (vol1h >= 100 && vol5m <= 2) {
    score = Math.max(0, score - 20);
  }

  return score;
}

/**
 * Staleness score -- based on the *maximum* age of either the buy or sell price.
 * The freshest possible prices are ~30s old due to API polling intervals.
 *
 * Thresholds:
 *   <5 min   -> 100
 *   <15 min  -> 85
 *   <30 min  -> 70
 *   <1 hour  -> 55
 *   <3 hours -> 40
 *   <6 hours -> 25
 *   >=6 hours or null -> 10
 */
function scoreStaleness(input: FlipScoringInput, now: Date): number {
  const buyAge = input.buyPriceTime
    ? now.getTime() - input.buyPriceTime.getTime()
    : null;
  const sellAge = input.sellPriceTime
    ? now.getTime() - input.sellPriceTime.getTime()
    : null;

  // If both are null, we can't determine freshness
  if (buyAge === null && sellAge === null) return 10;

  // Use the *oldest* of the two prices (weakest link)
  const maxAgeMs = Math.max(buyAge ?? 0, sellAge ?? 0);
  const maxAgeMinutes = maxAgeMs / (1000 * 60);

  if (maxAgeMinutes < 5) return 100;
  if (maxAgeMinutes < 15) return 85;
  if (maxAgeMinutes < 30) return 70;
  if (maxAgeMinutes < 60) return 55;
  if (maxAgeMinutes < 180) return 40;
  if (maxAgeMinutes < 360) return 25;
  return 10;
}

/**
 * Margin Stability score -- compares the live instant margin to the averaged
 * margin from 5m and 1h interval data. A large divergence suggests the
 * current margin is an outlier and may not be reliable.
 *
 * Enhanced: also checks 5m-vs-1h margin divergence. If these two timeframes
 * disagree significantly, the margin is unstable even if live happens to
 * match one of them.
 *
 * Divergence % = |liveMargin - avgMargin| / avgMargin * 100
 *
 * Thresholds:
 *   <5%  divergence -> 100
 *   <10% -> 85
 *   <20% -> 70
 *   <30% -> 55
 *   <50% -> 40
 *   >=50% -> 30
 *
 * Cross-timeframe penalty: if 5m margin and 1h margin diverge by >30%,
 * apply up to -15 penalty (suggesting a temporary margin appeared recently).
 */
function scoreMarginStability(input: FlipScoringInput): number {
  const liveMargin = input.margin;
  if (liveMargin === null) return 30;

  // Calculate averaged margin from interval data
  const avgMargins: number[] = [];
  let margin5m: number | null = null;
  let margin1h: number | null = null;

  if (input.avgHighPrice5m !== null && input.avgLowPrice5m !== null) {
    margin5m = input.avgHighPrice5m - input.avgLowPrice5m;
    avgMargins.push(margin5m);
  }
  if (input.avgHighPrice1h !== null && input.avgLowPrice1h !== null) {
    margin1h = input.avgHighPrice1h - input.avgLowPrice1h;
    avgMargins.push(margin1h);
  }

  if (avgMargins.length === 0) return 30;

  const avgMargin =
    avgMargins.reduce((sum, m) => sum + m, 0) / avgMargins.length;

  // If the average margin is zero or very small, avoid division by zero
  if (Math.abs(avgMargin) < 1) {
    // Both are tiny -- if live margin is also tiny, they agree
    return Math.abs(liveMargin) < 10 ? 85 : 40;
  }

  const divergencePercent =
    (Math.abs(liveMargin - avgMargin) / Math.abs(avgMargin)) * 100;

  let score: number;
  if (divergencePercent < 5) score = 100;
  else if (divergencePercent < 10) score = 85;
  else if (divergencePercent < 20) score = 70;
  else if (divergencePercent < 30) score = 55;
  else if (divergencePercent < 50) score = 40;
  else score = 30;

  // Cross-timeframe penalty: 5m margin vs 1h margin divergence
  // If the 5m margin and 1h margin themselves disagree, the margin
  // is in flux -- a temporary margin may have appeared recently
  if (margin5m !== null && margin1h !== null && Math.abs(margin1h) >= 1) {
    const crossDivergence =
      (Math.abs(margin5m - margin1h) / Math.abs(margin1h)) * 100;
    if (crossDivergence > 50) {
      score = Math.max(0, score - 15);
    } else if (crossDivergence > 30) {
      score = Math.max(0, score - 10);
    }
  }

  return score;
}

/**
 * Volume Adequacy score -- can the user actually fill their buy limit within
 * a reasonable time? Compares 1h volume against the item's buy limit.
 *
 * Ratio = volume1h / buyLimit
 *   >=2.0 -> 100  (volume is 2x buy limit per hour -- very liquid)
 *   >=1.0 -> 85
 *   >=0.5 -> 70
 *   >=0.2 -> 55
 *   >=0.1 -> 40
 *   <0.1  -> 30
 *
 * If buyLimit is null, we can't assess -- return a neutral 50.
 */
function scoreVolumeAdequacy(input: FlipScoringInput): number {
  const buyLimit = input.buyLimit;
  if (buyLimit === null || buyLimit <= 0) return 50;

  const volume = input.volume1h ?? input.volume5m ?? 0;
  if (volume <= 0) return 30;

  const ratio = volume / buyLimit;

  if (ratio >= 2.0) return 100;
  if (ratio >= 1.0) return 85;
  if (ratio >= 0.5) return 70;
  if (ratio >= 0.2) return 55;
  if (ratio >= 0.1) return 40;
  return 30;
}

/**
 * Buy Pressure score -- ratio of high-price (buyer) volume to total volume.
 * Higher buyer activity suggests stronger demand and easier sells.
 *
 * Uses 1h data (broader window) with 5m fallback.
 * buyerRatio = highPriceVolume / totalVolume
 *
 *   >70% -> 100  (strong buyer demand)
 *   >60% -> 80
 *   >50% -> 65   (balanced -- neutral)
 *   >40% -> 50
 *   <=40% -> 40  (seller-heavy -- harder to sell)
 *
 * If volume breakdown is unavailable, return neutral 50.
 */
function scoreBuyPressure(input: FlipScoringInput): number {
  // Prefer 1h data for broader representation
  let highVol = input.highPriceVolume1h;
  let lowVol = input.lowPriceVolume1h;

  // Fallback to 5m data
  if (highVol === null || lowVol === null) {
    highVol = input.highPriceVolume5m;
    lowVol = input.lowPriceVolume5m;
  }

  if (highVol === null || lowVol === null) return 50;

  const total = highVol + lowVol;
  if (total <= 0) return 50;

  const buyerRatio = highVol / total;

  if (buyerRatio > 0.7) return 100;
  if (buyerRatio > 0.6) return 80;
  if (buyerRatio > 0.5) return 65;
  if (buyerRatio > 0.4) return 50;
  return 40;
}

/**
 * Tax Efficiency score -- how much of the margin is consumed by GE tax.
 * taxRatio = tax / margin
 *
 *   <10% -> 100  (tax barely matters)
 *   <20% -> 85
 *   <30% -> 70
 *   <50% -> 55
 *   <70% -> 40
 *   >=70% -> 10  (tax eats most of the margin)
 *
 * If margin is zero/negative or tax is null, return 10.
 */
function scoreTaxEfficiency(input: FlipScoringInput): number {
  const { margin, tax } = input;

  if (margin === null || tax === null || margin <= 0) return 10;

  const taxRatio = tax / margin;

  if (taxRatio < 0.1) return 100;
  if (taxRatio < 0.2) return 85;
  if (taxRatio < 0.3) return 70;
  if (taxRatio < 0.5) return 55;
  if (taxRatio < 0.7) return 40;
  return 10;
}

/**
 * Volume Anomaly Detection score -- compares 5m volume rate to 1h volume rate.
 * If the 5m rate is wildly higher than the 1h rate, it's likely a spike
 * (someone is manipulating or there's a temporary event).
 *
 * expectedVolumeIn5m = volume1h / 12  (5-min portion of 1hr)
 * ratio = volume5m / expectedVolumeIn5m
 *
 * Scoring:
 *   ratio 0.5-2.0: normal (score 100)
 *   ratio 2.0-3.0: slightly elevated (score 75)
 *   ratio 3.0-5.0: suspicious spike (score 50)
 *   ratio 5.0-10.0: likely manipulation (score 25)
 *   ratio >10.0: extreme anomaly (score 10)
 *
 * Special case: if 5m volume is high but 1h volume is very low (<20),
 * that's a classic manipulation pattern -- score 15.
 *
 * Inverse case: if 5m is nearly zero but 1h is high, that's normal
 * decay and is not penalized -- score 100.
 */
function scoreVolumeAnomaly(input: FlipScoringInput): number {
  const vol5m = input.volume5m;
  const vol1h = input.volume1h;

  // If we have no data, return neutral
  if (vol5m === null && vol1h === null) return 50;

  // If both are zero or near-zero, no activity to judge
  if ((vol5m ?? 0) <= 0 && (vol1h ?? 0) <= 0) return 50;

  // If 5m is nearly zero but 1h is decent, that's normal decay -- not penalized
  if ((vol5m ?? 0) <= 1 && (vol1h ?? 0) > 10) return 100;

  // Special case: high 5m volume but very low 1h volume is a classic
  // manipulation pattern -- someone just started pumping
  if ((vol5m ?? 0) > 5 && (vol1h ?? 0) < 20) return 15;

  // If we don't have 1h data, we can't do rate comparison
  if (vol1h === null || vol1h <= 0) {
    // Only have 5m data -- if it's nonzero we can't tell much
    return (vol5m ?? 0) > 20 ? 40 : 60;
  }

  // If we don't have 5m data, can't compare
  if (vol5m === null) return 70;

  // Normal comparison: 5m rate vs 1h rate
  const expectedVolumeIn5m = vol1h / 12;

  // Avoid division by zero on very small expected values
  if (expectedVolumeIn5m < 0.1) {
    return vol5m > 5 ? 15 : 80;
  }

  const ratio = vol5m / expectedVolumeIn5m;

  if (ratio <= 2.0 && ratio >= 0.5) return 100;
  if (ratio < 0.5) return 100; // Low ratio = 5m is quieter than average, fine
  if (ratio <= 3.0) return 75;
  if (ratio <= 5.0) return 50;
  if (ratio <= 10.0) return 25;
  return 10;
}

/**
 * Price Consistency score -- compares live instant prices to averaged interval
 * prices. Large divergence means the current prices are unreliable or
 * represent an outlier trade.
 *
 * buyDivergence  = |buyPrice - avgHighPrice1h| / avgHighPrice1h
 * sellDivergence = |sellPrice - avgLowPrice1h| / avgLowPrice1h
 * maxDivergence  = max(buyDivergence, sellDivergence) * 100
 *
 * Scoring:
 *   <3%  -> 100 (prices align perfectly)
 *   <5%  -> 85
 *   <10% -> 70
 *   <15% -> 55
 *   <25% -> 35
 *   >=25% -> 15 (massive divergence = unreliable)
 *
 * Cross-check: if 5m and 1h averages themselves diverge significantly,
 * additional penalty applied.
 */
function scorePriceConsistency(input: FlipScoringInput): number {
  const { buyPrice, sellPrice, avgHighPrice1h, avgLowPrice1h } = input;

  // Need live prices and 1h averages to compare
  if (buyPrice === null || sellPrice === null) return 40;
  if (avgHighPrice1h === null || avgLowPrice1h === null) return 40;

  // Avoid division by zero
  if (avgHighPrice1h <= 0 || avgLowPrice1h <= 0) return 40;

  const buyDivergence = Math.abs(buyPrice - avgHighPrice1h) / avgHighPrice1h;
  const sellDivergence = Math.abs(sellPrice - avgLowPrice1h) / avgLowPrice1h;
  const maxDivergence = Math.max(buyDivergence, sellDivergence) * 100;

  let score: number;
  if (maxDivergence < 3) score = 100;
  else if (maxDivergence < 5) score = 85;
  else if (maxDivergence < 10) score = 70;
  else if (maxDivergence < 15) score = 55;
  else if (maxDivergence < 25) score = 35;
  else score = 15;

  // Cross-check: 5m averages vs 1h averages divergence
  // If the two timeframes themselves disagree, prices are in flux
  const { avgHighPrice5m, avgLowPrice5m } = input;
  if (
    avgHighPrice5m !== null &&
    avgLowPrice5m !== null &&
    avgHighPrice5m > 0 &&
    avgLowPrice5m > 0
  ) {
    const highTimeframeDivergence =
      (Math.abs(avgHighPrice5m - avgHighPrice1h) / avgHighPrice1h) * 100;
    const lowTimeframeDivergence =
      (Math.abs(avgLowPrice5m - avgLowPrice1h) / avgLowPrice1h) * 100;
    const maxTimeframeDivergence = Math.max(
      highTimeframeDivergence,
      lowTimeframeDivergence
    );

    // If 5m and 1h averages diverge by >15%, additional penalty
    if (maxTimeframeDivergence > 25) {
      score = Math.max(0, score - 15);
    } else if (maxTimeframeDivergence > 15) {
      score = Math.max(0, score - 10);
    }
  }

  return score;
}

/**
 * Historical Reliability score — uses persisted market data to validate
 * whether the current market conditions are consistent with long-term patterns.
 *
 * Checks:
 * 1. Do we have enough historical data? (more data = more reliable)
 * 2. Is the current price within normal range vs 30-day average?
 * 3. Is the current volume consistent with historical norms?
 * 4. Is the item's historical volatility acceptable?
 *
 * Without historical context, returns a neutral 50 (no data to judge).
 */
function scoreHistoricalReliability(input: FlipScoringInput): number {
  const ctx = input.historicalContext;

  // No historical data — return neutral
  if (!ctx || ctx.dataPoints < 3) return 50;

  let score = 50; // Base: having some data is already better than none

  // Data depth bonus (more data = more reliable baseline)
  if (ctx.dataPoints >= 30)
    score += 15; // ~1 month of daily data
  else if (ctx.dataPoints >= 14)
    score += 10; // ~2 weeks
  else if (ctx.dataPoints >= 7) score += 5; // ~1 week

  // Price vs 30-day average — is the current price within normal range?
  if (
    ctx.avgPrice30d !== null &&
    ctx.avgPrice30d > 0 &&
    input.buyPrice !== null
  ) {
    const priceDivergence =
      (Math.abs(input.buyPrice - ctx.avgPrice30d) / ctx.avgPrice30d) * 100;

    if (priceDivergence < 5)
      score += 15; // Tight alignment
    else if (priceDivergence < 10) score += 10;
    else if (priceDivergence < 20) score += 5;
    else if (priceDivergence > 40)
      score -= 15; // Extreme outlier
    else if (priceDivergence > 25) score -= 10;
  }

  // Volume vs 30-day average — is current volume normal?
  if (ctx.avgVolume30d !== null && ctx.avgVolume30d > 0) {
    const currentVolume = input.volume1h ?? input.volume5m ?? 0;
    const volumeRatio = currentVolume / ctx.avgVolume30d;

    if (volumeRatio >= 0.5 && volumeRatio <= 2.0)
      score += 10; // Normal range
    else if (volumeRatio > 5.0)
      score -= 10; // Suspicious spike vs history
    else if (volumeRatio < 0.1) score -= 5; // Abnormally quiet
  }

  // Volatility penalty — high historical volatility = less reliable margins
  if (ctx.volatility30d !== null) {
    if (ctx.volatility30d < 5)
      score += 10; // Very stable item
    else if (ctx.volatility30d < 10) score += 5;
    else if (ctx.volatility30d > 30)
      score -= 10; // Highly volatile
    else if (ctx.volatility30d > 20) score -= 5;
  }

  // --- Extended multi-timeframe bonuses (additive, won't break existing tests) ---

  // Long-term price alignment: if price is near the 365d average, extra confidence
  if (
    ctx.avgPrice365d != null &&
    ctx.avgPrice365d > 0 &&
    input.buyPrice !== null
  ) {
    const longTermDiv =
      (Math.abs(input.buyPrice - ctx.avgPrice365d) / ctx.avgPrice365d) * 100;
    if (longTermDiv < 10)
      score += 5; // Near long-term mean
    else if (longTermDiv > 50) score -= 5; // Far from long-term mean
  }

  // RSI extremes: overbought or oversold reduces flip reliability
  if (ctx.rsi14d != null) {
    if (ctx.rsi14d > 80)
      score -= 5; // Overbought — likely to reverse down
    else if (ctx.rsi14d < 20)
      score -= 5; // Oversold — unstable price
    else if (ctx.rsi14d >= 40 && ctx.rsi14d <= 60) score += 3; // Neutral RSI = stable
  }

  // Bollinger Band breach — price outside bands signals abnormality
  if (ctx.belowBollingerLower === true || ctx.aboveBollingerUpper === true) {
    score -= 5; // Price is at an extreme
  }

  // MACD confirmation: bullish signal + positive trend = extra trust
  if (ctx.macdSignal === 1) score += 3;
  else if (ctx.macdSignal === -1) score -= 3;

  return Math.max(0, Math.min(100, score));
}

// ---------------------------------------------------------------------------
// Flag detection
// ---------------------------------------------------------------------------

function detectFlags(
  input: FlipScoringInput,
  breakdown: FlipQualityBreakdown
): FlipQualityFlag[] {
  const flags: FlipQualityFlag[] = [];

  if (breakdown.staleness <= 25) {
    flags.push('stale-prices');
  }

  if (breakdown.liquidity <= 25) {
    flags.push('low-volume');
  }

  if (breakdown.marginStability <= 40) {
    flags.push('unstable-margin');
  }

  if (breakdown.taxEfficiency <= 40) {
    flags.push('high-tax-impact');
  }

  // Unprofitable after 2% GE tax: margin doesn't cover the tax
  if (input.margin !== null && input.tax !== null && input.margin > 0) {
    const postTaxMargin = input.margin - input.tax;
    if (postTaxMargin <= 0) {
      flags.push('unprofitable-after-tax');
    }
  }

  // Near alchemy price floor: sell price within 5% of alch floor
  // Items at their alch floor won't dip further but also won't rebound
  if (
    input.alchFloor != null &&
    input.alchFloor > 0 &&
    input.sellPrice !== null
  ) {
    const distPct =
      ((input.sellPrice - input.alchFloor) / input.alchFloor) * 100;
    if (distPct <= 5) {
      flags.push('near-alch-floor');
    }
  }

  // Thin market: low volume AND poor volume adequacy
  const volume = input.volume1h ?? input.volume5m ?? 0;
  if (volume < 50 && breakdown.volumeAdequacy <= 40) {
    flags.push('thin-market');
  }

  // Volume spike: abnormal volume pattern detected
  if (breakdown.volumeAnomaly <= 50) {
    flags.push('volume-spike');
  }

  // Price divergence: live prices diverge significantly from averages
  if (breakdown.priceConsistency <= 40) {
    flags.push('price-divergence');
  }

  // Potential manipulation: both volume spike AND price inconsistency together,
  // OR volume spike with thin market
  const isVolumeSpike = breakdown.volumeAnomaly <= 40;
  const isPriceDivergent = breakdown.priceConsistency <= 50;
  const isThinMarket = volume < 50 && breakdown.volumeAdequacy <= 40;

  if ((isVolumeSpike && isPriceDivergent) || (isVolumeSpike && isThinMarket)) {
    flags.push('potential-manipulation');
  }

  // Historical anomaly: current conditions don't match long-term patterns
  if (
    breakdown.historicalReliability <= 35 &&
    breakdown.historicalReliability !== 50
  ) {
    flags.push('historically-unusual');
  }

  return flags;
}

// ---------------------------------------------------------------------------
// Grade mapping
// ---------------------------------------------------------------------------

function scoreToGrade(score: number): FlipQualityGrade {
  for (const threshold of GRADE_THRESHOLDS) {
    if (score >= threshold.min) {
      return threshold.grade;
    }
  }
  return 'F';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Calculate the flip quality score for a single item.
 *
 * @param input  - The item's pricing/volume data
 * @param now    - Current time (passed in for testability)
 * @returns FlipQualityScore with grade, composite score, breakdown, and flags
 */
export function calculateFlipQualityScore(
  input: FlipScoringInput,
  now: Date = new Date()
): FlipQualityScore {
  const breakdown: FlipQualityBreakdown = {
    liquidity: scoreLiquidity(input),
    staleness: scoreStaleness(input, now),
    marginStability: scoreMarginStability(input),
    volumeAdequacy: scoreVolumeAdequacy(input),
    buyPressure: scoreBuyPressure(input),
    taxEfficiency: scoreTaxEfficiency(input),
    volumeAnomaly: scoreVolumeAnomaly(input),
    priceConsistency: scorePriceConsistency(input),
    historicalReliability: scoreHistoricalReliability(input),
  };

  const compositeScore = Math.round(
    breakdown.liquidity * WEIGHTS.liquidity +
      breakdown.staleness * WEIGHTS.staleness +
      breakdown.marginStability * WEIGHTS.marginStability +
      breakdown.volumeAdequacy * WEIGHTS.volumeAdequacy +
      breakdown.buyPressure * WEIGHTS.buyPressure +
      breakdown.taxEfficiency * WEIGHTS.taxEfficiency +
      breakdown.volumeAnomaly * WEIGHTS.volumeAnomaly +
      breakdown.priceConsistency * WEIGHTS.priceConsistency +
      breakdown.historicalReliability * WEIGHTS.historicalReliability
  );

  const flags = detectFlags(input, breakdown);
  const grade = scoreToGrade(compositeScore);

  return {
    grade,
    score: compositeScore,
    breakdown,
    flags,
  };
}

/**
 * Grade ordering map for comparison/filtering.
 * Lower value = better grade.
 */
export const GRADE_ORDER: Record<FlipQualityGrade, number> = {
  A: 0,
  B: 1,
  C: 2,
  D: 3,
  F: 4,
};

/**
 * Check if a grade meets a minimum grade threshold.
 * e.g. meetsMinimumGrade('A', 'B') -> true (A is better than B)
 *      meetsMinimumGrade('D', 'B') -> false (D is worse than B)
 */
export function meetsMinimumGrade(
  grade: FlipQualityGrade,
  minGrade: FlipQualityGrade
): boolean {
  return GRADE_ORDER[grade] <= GRADE_ORDER[minGrade];
}

/**
 * Human-readable descriptions for each flag.
 */
export const FLAG_DESCRIPTIONS: Record<FlipQualityFlag, string> = {
  'stale-prices': 'Prices may be outdated — last trade was over 3 hours ago',
  'low-volume': 'Very low trading volume — may be hard to buy or sell',
  'unstable-margin':
    'Margin is inconsistent with recent averages — may be an outlier',
  'high-tax-impact':
    'GE tax consumes a large portion of the margin on this item',
  'unprofitable-after-tax':
    'This item loses money after the 2% GE tax — the margin does not cover the tax',
  'near-alch-floor':
    'Price is near the high alchemy floor — limited downside but unlikely to rebound further',
  'thin-market':
    'Thin market — low volume and hard to fill buy limit in reasonable time',
  'volume-spike':
    'Abnormal volume spike detected — recent activity is far above the hourly rate',
  'price-divergence':
    'Live prices diverge significantly from historical averages — current spread may be unreliable',
  'potential-manipulation':
    'Possible price manipulation — abnormal volume combined with inconsistent prices or thin market',
  'historically-unusual':
    "Current market conditions diverge significantly from this item's long-term historical patterns",
};

/**
 * Human-readable descriptions for each grade.
 */
export const GRADE_DESCRIPTIONS: Record<FlipQualityGrade, string> = {
  A: 'Excellent flip — liquid, fresh prices, stable margin, consistent patterns, and low tax impact',
  B: 'Good flip — reliable with minor concerns',
  C: 'Average flip — some risk factors present',
  D: 'Risky flip — multiple concerns, proceed with caution',
  F: 'Poor flip — significant issues make this unreliable',
};
