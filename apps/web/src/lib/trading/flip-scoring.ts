/**
 * Flip Quality Scoring Engine
 *
 * Evaluates GE items for flip quality using a composite scoring system.
 * Each item receives a score from 0-100 based on 6 weighted sub-scores,
 * mapped to a letter grade (A-F) with optional warning flags.
 *
 * Sub-scores:
 *   Liquidity (25%)        – How actively traded is this item?
 *   Staleness (20%)        – How fresh are the latest buy/sell prices?
 *   Margin Stability (20%) – Does the live margin match the averaged margin?
 *   Volume Adequacy (15%)  – Can you fill your buy limit in reasonable time?
 *   Buy Pressure (10%)     – Is there more buying or selling activity?
 *   Tax Efficiency (10%)   – How much does GE tax eat into the margin?
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
  | 'thin-market';

export interface FlipQualityBreakdown {
  liquidity: number; // 0-100
  staleness: number; // 0-100
  marginStability: number; // 0-100
  volumeAdequacy: number; // 0-100
  buyPressure: number; // 0-100
  taxEfficiency: number; // 0-100
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
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Sub-score weights must sum to 1.0 */
const WEIGHTS = {
  liquidity: 0.25,
  staleness: 0.2,
  marginStability: 0.2,
  volumeAdequacy: 0.15,
  buyPressure: 0.1,
  taxEfficiency: 0.1,
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
 * Liquidity score — based on combined 1h volume (primary) or 5m volume (fallback).
 *
 * Thresholds (1h volume):
 *   1000+ → 100
 *   500   → 85
 *   200   → 70
 *   100   → 55
 *   50    → 40
 *   10    → 25
 *   1     → 15
 *   0     → 0
 */
function scoreLiquidity(input: FlipScoringInput): number {
  const volume = input.volume1h ?? input.volume5m ?? 0;

  if (volume <= 0) return 0;
  if (volume < 10) return 15;
  if (volume < 50) return 25;
  if (volume < 100) return 40;
  if (volume < 200) return 55;
  if (volume < 500) return 70;
  if (volume < 1000) return 85;
  return 100;
}

/**
 * Staleness score — based on the *maximum* age of either the buy or sell price.
 * The freshest possible prices are ~30s old due to API polling intervals.
 *
 * Thresholds:
 *   <5 min   → 100
 *   <15 min  → 85
 *   <30 min  → 70
 *   <1 hour  → 55
 *   <3 hours → 40
 *   <6 hours → 25
 *   >=6 hours or null → 10
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
 * Margin Stability score — compares the live instant margin to the averaged
 * margin from 5m and 1h interval data. A large divergence suggests the
 * current margin is an outlier and may not be reliable.
 *
 * We compare live margin against the average of 5m and 1h avg margins.
 * Divergence % = |liveMargin - avgMargin| / avgMargin * 100
 *
 * Thresholds:
 *   <5%  divergence → 100
 *   <10% → 85
 *   <20% → 70
 *   <30% → 55
 *   <50% → 40
 *   >=50% → 30
 */
function scoreMarginStability(input: FlipScoringInput): number {
  const liveMargin = input.margin;
  if (liveMargin === null) return 30;

  // Calculate averaged margin from interval data
  const avgMargins: number[] = [];

  if (input.avgHighPrice5m !== null && input.avgLowPrice5m !== null) {
    avgMargins.push(input.avgHighPrice5m - input.avgLowPrice5m);
  }
  if (input.avgHighPrice1h !== null && input.avgLowPrice1h !== null) {
    avgMargins.push(input.avgHighPrice1h - input.avgLowPrice1h);
  }

  if (avgMargins.length === 0) return 30;

  const avgMargin =
    avgMargins.reduce((sum, m) => sum + m, 0) / avgMargins.length;

  // If the average margin is zero or very small, avoid division by zero
  if (Math.abs(avgMargin) < 1) {
    // Both are tiny — if live margin is also tiny, they agree
    return Math.abs(liveMargin) < 10 ? 85 : 40;
  }

  const divergencePercent =
    (Math.abs(liveMargin - avgMargin) / Math.abs(avgMargin)) * 100;

  if (divergencePercent < 5) return 100;
  if (divergencePercent < 10) return 85;
  if (divergencePercent < 20) return 70;
  if (divergencePercent < 30) return 55;
  if (divergencePercent < 50) return 40;
  return 30;
}

/**
 * Volume Adequacy score — can the user actually fill their buy limit within
 * a reasonable time? Compares 1h volume against the item's buy limit.
 *
 * Ratio = volume1h / buyLimit
 *   >=2.0 → 100  (volume is 2x buy limit per hour — very liquid)
 *   >=1.0 → 85
 *   >=0.5 → 70
 *   >=0.2 → 55
 *   >=0.1 → 40
 *   <0.1  → 30
 *
 * If buyLimit is null, we can't assess — return a neutral 50.
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
 * Buy Pressure score — ratio of high-price (buyer) volume to total volume.
 * Higher buyer activity suggests stronger demand and easier sells.
 *
 * Uses 1h data (broader window) with 5m fallback.
 * buyerRatio = highPriceVolume / totalVolume
 *
 *   >70% → 100  (strong buyer demand)
 *   >60% → 80
 *   >50% → 65   (balanced — neutral)
 *   >40% → 50
 *   <=40% → 40  (seller-heavy — harder to sell)
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
 * Tax Efficiency score — how much of the margin is consumed by GE tax.
 * taxRatio = tax / margin
 *
 *   <10% → 100  (tax barely matters)
 *   <20% → 85
 *   <30% → 70
 *   <50% → 55
 *   <70% → 40
 *   >=70% → 10  (tax eats most of the margin)
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

  // Thin market: low volume AND poor volume adequacy
  const volume = input.volume1h ?? input.volume5m ?? 0;
  if (volume < 50 && breakdown.volumeAdequacy <= 40) {
    flags.push('thin-market');
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
  };

  const compositeScore = Math.round(
    breakdown.liquidity * WEIGHTS.liquidity +
      breakdown.staleness * WEIGHTS.staleness +
      breakdown.marginStability * WEIGHTS.marginStability +
      breakdown.volumeAdequacy * WEIGHTS.volumeAdequacy +
      breakdown.buyPressure * WEIGHTS.buyPressure +
      breakdown.taxEfficiency * WEIGHTS.taxEfficiency
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
 * e.g. meetsMinimumGrade('A', 'B') → true (A is better than B)
 *      meetsMinimumGrade('D', 'B') → false (D is worse than B)
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
  'thin-market':
    'Thin market — low volume and hard to fill buy limit in reasonable time',
};

/**
 * Human-readable descriptions for each grade.
 */
export const GRADE_DESCRIPTIONS: Record<FlipQualityGrade, string> = {
  A: 'Excellent flip — liquid, fresh prices, stable margin, and low tax impact',
  B: 'Good flip — reliable with minor concerns',
  C: 'Average flip — some risk factors present',
  D: 'Risky flip — multiple concerns, proceed with caution',
  F: 'Poor flip — significant issues make this unreliable',
};
