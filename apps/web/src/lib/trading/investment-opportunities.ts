/**
 * Investment Opportunities Service
 *
 * Identifies items where historical data suggests a price rebound or
 * seasonal rise is coming. These are "buy and hold" recommendations,
 * different from quick flip suggestions.
 *
 * Sources of signal:
 *   1. Price dip — current price significantly below 30-day average
 *   2. Seasonal pattern — historical data shows this month/next month
 *      typically sees a price increase for this item
 *   3. Trend reversal — short-term falling but long-term rising
 *   4. Volume recovery — volume picking back up after a quiet period
 */

import type { GeDailySummary } from '@skillbound/database';

import {
  analyzeItemMarket,
  computeBollingerBands,
  computeMACD,
  computeRSI,
  type ItemMarketAnalysis,
  type MarketInsight,
} from './market-analysis';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OpportunityType =
  | 'price-dip'
  | 'seasonal-rise'
  | 'trend-reversal'
  | 'undervalued';

export interface InvestmentOpportunity {
  itemId: number;
  itemName: string;
  currentPrice: number;
  type: OpportunityType;
  confidence: 'high' | 'medium' | 'low';
  title: string;
  reason: string;
  /** Expected price movement (percent) based on historical patterns */
  expectedChange: number | null;
  /** How many days of data support this recommendation */
  dataPoints: number;
  /** Key insights backing this recommendation */
  insights: MarketInsight[];
}

// ---------------------------------------------------------------------------
// Opportunity detection
// ---------------------------------------------------------------------------

/**
 * Scan a single item's historical data for investment opportunities.
 * Returns null if no actionable opportunity is found.
 */
export function detectOpportunity(
  itemId: number,
  itemName: string,
  summaries: GeDailySummary[],
  currentPrice: number | null,
  options?: { alchFloor?: number | null | undefined }
): InvestmentOpportunity | null {
  if (!currentPrice || currentPrice <= 0 || summaries.length < 7) return null;

  // Items near their alchemy price floor won't rebound — skip price-dip signals
  const nearAlchFloor =
    options?.alchFloor != null &&
    options.alchFloor > 0 &&
    ((currentPrice - options.alchFloor) / options.alchFloor) * 100 <= 5;

  const analysis = analyzeItemMarket(itemId, summaries, currentPrice);

  // Skip items with too little data
  if (analysis.dataPoints < 7) return null;

  // Compute technical indicators from full price history
  const prices = summaries
    .map((s) => s.avgBuyPrice)
    .filter((p): p is number => p !== null);

  const technicals = {
    rsi: prices.length >= 15 ? computeRSI(prices, 14) : null,
    bollinger:
      prices.length >= 20 ? computeBollingerBands(prices, 20, 2) : null,
    macd: prices.length >= 35 ? computeMACD(prices) : null,
  };

  // Try each signal type in order of strength.
  // Items near their alch floor skip price-dip and undervalued signals — those
  // "dips" are structural (alch floor), not mean-reversion opportunities.
  return (
    (!nearAlchFloor
      ? detectPriceDip(itemId, itemName, currentPrice, analysis, technicals)
      : null) ??
    (!nearAlchFloor
      ? detectTechnicalUndervalued(
          itemId,
          itemName,
          currentPrice,
          analysis,
          technicals
        )
      : null) ??
    detectSeasonalRise(itemId, itemName, currentPrice, analysis) ??
    detectTrendReversal(itemId, itemName, currentPrice, analysis, technicals) ??
    null
  );
}

/**
 * Technical analysis signals: RSI oversold + below Bollinger lower band,
 * or MACD bullish crossover combined with price below average.
 */
function detectTechnicalUndervalued(
  itemId: number,
  itemName: string,
  currentPrice: number,
  analysis: ItemMarketAnalysis,
  technicals: {
    rsi: number | null;
    bollinger: { upper: number; middle: number; lower: number } | null;
    macd: {
      macd: number;
      signal: number;
      histogram: number;
      crossover: 1 | -1 | 0;
    } | null;
  }
): InvestmentOpportunity | null {
  const signals: string[] = [];
  let confidenceScore = 0;

  // RSI oversold (< 30 = classic oversold signal)
  if (technicals.rsi !== null && technicals.rsi < 30) {
    signals.push(`RSI at ${technicals.rsi.toFixed(0)} (oversold)`);
    confidenceScore += technicals.rsi < 20 ? 3 : 2;
  }

  // Below lower Bollinger Band — price at statistical extreme
  if (technicals.bollinger && currentPrice < technicals.bollinger.lower) {
    const pctBelow =
      ((technicals.bollinger.lower - currentPrice) /
        technicals.bollinger.lower) *
      100;
    signals.push(`${pctBelow.toFixed(1)}% below lower Bollinger Band`);
    confidenceScore += 2;
  }

  // MACD bullish crossover — momentum shifting upward
  if (technicals.macd?.crossover === 1) {
    signals.push('MACD bullish crossover');
    confidenceScore += 2;
  }

  // Price below 30d average adds weight
  if (analysis.priceVsAvg30d !== null && analysis.priceVsAvg30d < -5) {
    confidenceScore += 1;
  }

  // Need at least 2 signals for an undervalued call
  if (signals.length < 2 || confidenceScore < 3) return null;

  const confidence: 'high' | 'medium' | 'low' =
    confidenceScore >= 5 ? 'high' : confidenceScore >= 3 ? 'medium' : 'low';

  // Estimate expected change from mean reversion
  const expectedChange =
    analysis.priceVsAvg30d !== null
      ? Math.round(Math.abs(analysis.priceVsAvg30d) * 0.5 * 10) / 10
      : 5;

  return {
    itemId,
    itemName,
    currentPrice,
    type: 'undervalued',
    confidence,
    title: 'Technically undervalued',
    reason: `Multiple technical indicators suggest this item is undervalued: ${signals.join('; ')}.`,
    expectedChange,
    dataPoints: analysis.dataPoints,
    insights: analysis.insights.filter(
      (i) => i.type === 'buy-signal' || i.type === 'trend-alert'
    ),
  };
}

/**
 * Price dip: current price is significantly below the historical average,
 * suggesting mean reversion.
 */
function detectPriceDip(
  itemId: number,
  itemName: string,
  currentPrice: number,
  analysis: ItemMarketAnalysis,
  technicals: {
    rsi: number | null;
    bollinger: { upper: number; middle: number; lower: number } | null;
    macd: {
      macd: number;
      signal: number;
      histogram: number;
      crossover: 1 | -1 | 0;
    } | null;
  }
): InvestmentOpportunity | null {
  const { priceVsAvg30d, priceVsAvg90d, priceVolatility30d, avgPrice30d } =
    analysis;

  // Need a meaningful dip below 30d average
  if (priceVsAvg30d === null || priceVsAvg30d > -10) return null;

  // Skip if extremely volatile — dips are noise, not opportunities
  if (priceVolatility30d !== null && priceVolatility30d > 30) return null;

  // Stronger signal if also below 90d average
  const deepDip = priceVsAvg90d !== null && priceVsAvg90d < -15;

  // Technical confirmation boosts confidence
  const rsiOversold = technicals.rsi !== null && technicals.rsi < 35;
  const belowBollinger =
    technicals.bollinger !== null && currentPrice < technicals.bollinger.lower;
  const macdBullish = technicals.macd?.crossover === 1;

  const technicalConfirmations =
    (rsiOversold ? 1 : 0) + (belowBollinger ? 1 : 0) + (macdBullish ? 1 : 0);

  const confidence =
    priceVsAvg30d < -20 || deepDip || technicalConfirmations >= 2
      ? 'high'
      : 'medium';

  // Mean reversion estimate — higher if technically confirmed
  const reversionFactor = technicalConfirmations > 0 ? 0.7 : 0.6;
  const expectedReturn = Math.abs(priceVsAvg30d) * reversionFactor;

  const reasonParts = [
    `Currently ${Math.abs(priceVsAvg30d).toFixed(0)}% below its 30-day average of ${avgPrice30d?.toLocaleString() ?? '?'} gp.`,
  ];
  if (rsiOversold)
    reasonParts.push(`RSI at ${technicals.rsi!.toFixed(0)} (oversold).`);
  if (belowBollinger) reasonParts.push('Below lower Bollinger Band.');
  if (macdBullish) reasonParts.push('MACD shows bullish crossover.');

  return {
    itemId,
    itemName,
    currentPrice,
    type: 'price-dip',
    confidence,
    title: 'Price below historical average',
    reason: reasonParts.join(' '),
    expectedChange: Math.round(expectedReturn * 10) / 10,
    dataPoints: analysis.dataPoints,
    insights: analysis.insights.filter(
      (i) => i.type === 'buy-signal' || i.type === 'trend-alert'
    ),
  };
}

/**
 * Seasonal rise: historical data shows this item typically increases
 * in price during the current or next month.
 */
function detectSeasonalRise(
  itemId: number,
  itemName: string,
  currentPrice: number,
  analysis: ItemMarketAnalysis
): InvestmentOpportunity | null {
  if (analysis.seasonalPatterns.length === 0) return null;

  const currentMonth = new Date().getUTCMonth() + 1;
  const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;

  // Look for a seasonal rise this month or next month
  const relevantPattern = analysis.seasonalPatterns.find(
    (p) =>
      (p.month === currentMonth || p.month === nextMonth) &&
      p.avgPriceChange > 5 &&
      p.confidence !== 'low'
  );

  if (!relevantPattern) return null;

  const isUpcoming = relevantPattern.month === nextMonth;

  return {
    itemId,
    itemName,
    currentPrice,
    type: 'seasonal-rise',
    confidence: relevantPattern.confidence,
    title: isUpcoming
      ? `Seasonal rise expected in ${relevantPattern.monthName}`
      : `Seasonal rise underway (${relevantPattern.monthName})`,
    reason: `Historically rises ~${relevantPattern.avgPriceChange.toFixed(0)}% during ${relevantPattern.monthName} (based on ${relevantPattern.sampleSize} year${relevantPattern.sampleSize > 1 ? 's' : ''} of data).`,
    expectedChange: Math.round(relevantPattern.avgPriceChange * 10) / 10,
    dataPoints: analysis.dataPoints,
    insights: analysis.insights.filter(
      (i) => i.type === 'seasonal-pattern' || i.type === 'buy-signal'
    ),
  };
}

/**
 * Trend reversal: short-term falling but long-term rising — the recent
 * dip might be a buying opportunity within a larger uptrend.
 */
function detectTrendReversal(
  itemId: number,
  itemName: string,
  currentPrice: number,
  analysis: ItemMarketAnalysis,
  technicals: {
    rsi: number | null;
    bollinger: { upper: number; middle: number; lower: number } | null;
    macd: {
      macd: number;
      signal: number;
      histogram: number;
      crossover: 1 | -1 | 0;
    } | null;
  }
): InvestmentOpportunity | null {
  const { priceTrend7d, priceTrend30d } = analysis;

  if (!priceTrend7d || !priceTrend30d) return null;

  // 7d falling + 30d rising = potential pullback in an uptrend
  if (
    priceTrend7d.direction !== 'falling' ||
    priceTrend30d.direction !== 'rising'
  )
    return null;

  // Need reasonable confidence in the 30d trend
  if (priceTrend30d.confidence === 'low') return null;

  // The 7d drop should be meaningful
  if (Math.abs(priceTrend7d.changePercent) < 3) return null;

  // MACD bullish crossover strengthens the reversal signal
  const macdConfirms = technicals.macd?.crossover === 1;
  const rsiNeutral =
    technicals.rsi !== null && technicals.rsi >= 30 && technicals.rsi <= 50;

  const confidence =
    (priceTrend30d.confidence === 'high' &&
      Math.abs(priceTrend7d.changePercent) > 5) ||
    macdConfirms
      ? 'high'
      : 'medium';

  const reasonParts = [
    `Dropped ${Math.abs(priceTrend7d.changePercent).toFixed(0)}% this week, but the 30-day trend is up ${priceTrend30d.changePercent.toFixed(0)}%.`,
  ];
  if (macdConfirms) reasonParts.push('MACD confirms bullish momentum shift.');
  if (rsiNeutral)
    reasonParts.push(
      `RSI at ${technicals.rsi!.toFixed(0)} — not oversold, room to recover.`
    );

  return {
    itemId,
    itemName,
    currentPrice,
    type: 'trend-reversal',
    confidence,
    title: 'Pullback in uptrend',
    reason: reasonParts.join(' '),
    expectedChange:
      Math.round(Math.abs(priceTrend7d.changePercent) * 0.7 * 10) / 10,
    dataPoints: analysis.dataPoints,
    insights: analysis.insights.filter(
      (i) => i.type === 'trend-alert' || i.type === 'info'
    ),
  };
}

// ---------------------------------------------------------------------------
// Batch scanning
// ---------------------------------------------------------------------------

export interface ScanResult {
  opportunities: InvestmentOpportunity[];
  itemsScanned: number;
  itemsWithData: number;
}

/**
 * Scan a batch of items for investment opportunities.
 * Pass pre-fetched summaries keyed by itemId.
 */
export function scanForOpportunities(
  items: Array<{
    itemId: number;
    itemName: string;
    currentPrice: number | null;
    summaries: GeDailySummary[];
    alchFloor?: number | null;
  }>
): ScanResult {
  const opportunities: InvestmentOpportunity[] = [];
  let itemsWithData = 0;

  for (const item of items) {
    if (item.summaries.length >= 7) itemsWithData++;

    const opp = detectOpportunity(
      item.itemId,
      item.itemName,
      item.summaries,
      item.currentPrice,
      { alchFloor: item.alchFloor }
    );

    if (opp) {
      opportunities.push(opp);
    }
  }

  // Sort by confidence (high first) then by expected change
  const confidenceOrder = { high: 0, medium: 1, low: 2 };
  opportunities.sort((a, b) => {
    const confDiff =
      confidenceOrder[a.confidence] - confidenceOrder[b.confidence];
    if (confDiff !== 0) return confDiff;
    return (b.expectedChange ?? 0) - (a.expectedChange ?? 0);
  });

  return {
    opportunities: opportunities.slice(0, 50), // Top 50
    itemsScanned: items.length,
    itemsWithData,
  };
}
