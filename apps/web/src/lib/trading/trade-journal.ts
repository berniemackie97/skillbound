/**
 * Trade Journal
 *
 * Structured journaling for trade reflections. Each entry captures
 * the reasoning behind a trade, the outcome, and lessons learned.
 * Entries can be tagged and searched to identify recurring patterns
 * in a user's trading behaviour.
 *
 * This module provides pure-function utilities for working with
 * journal entries. Persistence is handled at the API layer.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type JournalTag =
  | 'flip'
  | 'investment'
  | 'panic-sell'
  | 'fomo-buy'
  | 'planned'
  | 'impulse'
  | 'news-driven'
  | 'technical'
  | 'fundamental'
  | 'lesson-learned';

export interface JournalEntry {
  id: string;
  /** Associated trade ID (optional — entries can be standalone) */
  tradeId?: string | undefined;
  /** Item context */
  itemId?: number | undefined;
  itemName?: string | undefined;
  /** Entry details */
  title: string;
  body: string;
  /** Outcome assessment */
  outcome: 'profit' | 'loss' | 'breakeven' | 'pending';
  /** Self-rated confidence before the trade (1–5) */
  confidenceBefore?: number | undefined;
  /** Self-rated confidence after (1–5) */
  confidenceAfter?: number | undefined;
  /** Categorisation tags */
  tags: JournalTag[];
  /** GP result if known */
  profitLoss?: number | undefined;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

export interface JournalAnalysis {
  totalEntries: number;
  outcomeBreakdown: Record<JournalEntry['outcome'], number>;
  tagFrequency: Partial<Record<JournalTag, number>>;
  /** Average confidence before vs after — reveals overconfidence bias */
  avgConfidenceBefore: number | null;
  avgConfidenceAfter: number | null;
  /** Entries tagged 'impulse' or 'fomo-buy' or 'panic-sell' */
  emotionalTradeCount: number;
  /** % of emotional trades that resulted in a loss */
  emotionalLossRate: number | null;
  /** Entries tagged 'planned' */
  plannedTradeCount: number;
  /** % of planned trades that resulted in profit */
  plannedWinRate: number | null;
}

const EMOTIONAL_TAGS: JournalTag[] = ['impulse', 'fomo-buy', 'panic-sell'];

/**
 * Analyse a set of journal entries to find behavioural patterns.
 */
export function analyzeJournal(entries: JournalEntry[]): JournalAnalysis {
  if (entries.length === 0) {
    return {
      totalEntries: 0,
      outcomeBreakdown: { profit: 0, loss: 0, breakeven: 0, pending: 0 },
      tagFrequency: {},
      avgConfidenceBefore: null,
      avgConfidenceAfter: null,
      emotionalTradeCount: 0,
      emotionalLossRate: null,
      plannedTradeCount: 0,
      plannedWinRate: null,
    };
  }

  // Outcome breakdown
  const outcomeBreakdown: Record<JournalEntry['outcome'], number> = {
    profit: 0,
    loss: 0,
    breakeven: 0,
    pending: 0,
  };
  for (const e of entries) {
    outcomeBreakdown[e.outcome]++;
  }

  // Tag frequency
  const tagFrequency: Partial<Record<JournalTag, number>> = {};
  for (const e of entries) {
    for (const tag of e.tags) {
      tagFrequency[tag] = (tagFrequency[tag] ?? 0) + 1;
    }
  }

  // Confidence averages
  const withConfBefore = entries.filter((e) => e.confidenceBefore != null);
  const withConfAfter = entries.filter((e) => e.confidenceAfter != null);
  const avgConfidenceBefore =
    withConfBefore.length > 0
      ? Math.round(
          (withConfBefore.reduce((s, e) => s + e.confidenceBefore!, 0) /
            withConfBefore.length) *
            100
        ) / 100
      : null;
  const avgConfidenceAfter =
    withConfAfter.length > 0
      ? Math.round(
          (withConfAfter.reduce((s, e) => s + e.confidenceAfter!, 0) /
            withConfAfter.length) *
            100
        ) / 100
      : null;

  // Emotional trade analysis
  const emotionalEntries = entries.filter((e) =>
    e.tags.some((t) => EMOTIONAL_TAGS.includes(t))
  );
  const emotionalLosses = emotionalEntries.filter((e) => e.outcome === 'loss');
  const emotionalLossRate =
    emotionalEntries.length > 0
      ? Math.round((emotionalLosses.length / emotionalEntries.length) * 10000) /
        100
      : null;

  // Planned trade analysis
  const plannedEntries = entries.filter((e) => e.tags.includes('planned'));
  const plannedWins = plannedEntries.filter((e) => e.outcome === 'profit');
  const plannedWinRate =
    plannedEntries.length > 0
      ? Math.round((plannedWins.length / plannedEntries.length) * 10000) / 100
      : null;

  return {
    totalEntries: entries.length,
    outcomeBreakdown,
    tagFrequency,
    avgConfidenceBefore,
    avgConfidenceAfter,
    emotionalTradeCount: emotionalEntries.length,
    emotionalLossRate,
    plannedTradeCount: plannedEntries.length,
    plannedWinRate,
  };
}

/**
 * Search journal entries by text (title + body).
 */
export function searchJournal(
  entries: JournalEntry[],
  query: string
): JournalEntry[] {
  const lower = query.toLowerCase();
  return entries.filter(
    (e) =>
      e.title.toLowerCase().includes(lower) ||
      e.body.toLowerCase().includes(lower)
  );
}

/**
 * Filter journal entries by tags (any match).
 */
export function filterByTags(
  entries: JournalEntry[],
  tags: JournalTag[]
): JournalEntry[] {
  return entries.filter((e) => e.tags.some((t) => tags.includes(t)));
}

/**
 * Get entries for a specific item.
 */
export function getEntriesForItem(
  entries: JournalEntry[],
  itemId: number
): JournalEntry[] {
  return entries.filter((e) => e.itemId === itemId);
}
