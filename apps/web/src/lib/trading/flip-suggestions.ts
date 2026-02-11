/**
 * Flip Suggestions Persistence Service
 *
 * Manages the geFlipSuggestions table — stores periodic snapshots of
 * flip quality scores for analytics and the "Find Me a Flip" feature.
 */

import {
  desc,
  eq,
  geFlipSuggestions,
  gte,
  type GeFlipSuggestion,
  type NewGeFlipSuggestion,
  sql,
} from '@skillbound/database';

import { getDbClient } from '../db';
import { logger } from '../logging/logger';
import type { FlipQualityGrade, FlipQualityScore } from './flip-scoring';
import { meetsMinimumGrade } from './flip-scoring';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FlipSuggestionInput {
  itemId: number;
  itemName: string;
  currentMargin: number;
  marginPercent: number;
  buyPrice: number;
  sellPrice: number;
  dailyVolume: number | null;
  profitPotential: 'high' | 'medium' | 'low';
  flipQuality: FlipQualityScore;
}

export interface GetFlipSuggestionsOptions {
  minGrade?: FlipQualityGrade;
  minMargin?: number;
  minScore?: number;
  limit?: number;
  offset?: number;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Get flip suggestions with optional filtering by grade, margin, score.
 */
export async function getFlipSuggestions(
  options: GetFlipSuggestionsOptions = {}
): Promise<GeFlipSuggestion[]> {
  const db = getDbClient();
  const { minGrade, minMargin, minScore, limit = 50, offset = 0 } = options;

  let query = db
    .select()
    .from(geFlipSuggestions)
    .orderBy(desc(geFlipSuggestions.flipQualityScore))
    .limit(limit)
    .offset(offset)
    .$dynamic();

  if (minMargin !== undefined) {
    query = query.where(gte(geFlipSuggestions.currentMargin, minMargin));
  }

  if (minScore !== undefined) {
    query = query.where(gte(geFlipSuggestions.flipQualityScore, minScore));
  }

  const results = await query;

  // Filter by grade in application layer (since grades are categorical)
  if (minGrade !== undefined) {
    return results.filter((row) => {
      if (!row.flipQualityGrade) return false;
      return meetsMinimumGrade(
        row.flipQualityGrade as FlipQualityGrade,
        minGrade
      );
    });
  }

  return results;
}

/**
 * Get a single flip suggestion for a specific item.
 */
export async function getFlipSuggestionForItem(
  itemId: number
): Promise<GeFlipSuggestion | null> {
  const db = getDbClient();

  const [suggestion] = await db
    .select()
    .from(geFlipSuggestions)
    .where(eq(geFlipSuggestions.itemId, itemId))
    .limit(1);

  return suggestion ?? null;
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Derive profit potential category from margin percent.
 */
function deriveProfitPotential(
  marginPercent: number
): 'high' | 'medium' | 'low' {
  if (marginPercent >= 5) return 'high';
  if (marginPercent >= 2) return 'medium';
  return 'low';
}

/**
 * Bulk upsert flip suggestions — used by the cron job to snapshot scores.
 * Uses a batched approach to avoid overwhelming the database.
 */
export async function bulkUpsertFlipSuggestions(
  items: FlipSuggestionInput[]
): Promise<{ upserted: number; errors: number }> {
  const db = getDbClient();
  let upserted = 0;
  let errors = 0;

  // Process in batches of 50
  const batchSize = 50;
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);

    const values: NewGeFlipSuggestion[] = batch.map((item) => ({
      itemId: item.itemId,
      itemName: item.itemName,
      currentMargin: item.currentMargin,
      marginPercent: item.marginPercent.toFixed(2),
      buyPrice: item.buyPrice,
      sellPrice: item.sellPrice,
      dailyVolume: item.dailyVolume,
      profitPotential:
        item.profitPotential ?? deriveProfitPotential(item.marginPercent),
      flipQualityGrade: item.flipQuality.grade,
      flipQualityScore: item.flipQuality.score,
      qualityLiquidity: item.flipQuality.breakdown.liquidity,
      qualityStaleness: item.flipQuality.breakdown.staleness,
      qualityMarginStability: item.flipQuality.breakdown.marginStability,
      qualityVolumeAdequacy: item.flipQuality.breakdown.volumeAdequacy,
      qualityBuyPressure: item.flipQuality.breakdown.buyPressure,
      qualityTaxEfficiency: item.flipQuality.breakdown.taxEfficiency,
      qualityFlags: item.flipQuality.flags,
      calculatedAt: new Date(),
    }));

    try {
      await db
        .insert(geFlipSuggestions)
        .values(values)
        .onConflictDoUpdate({
          target: geFlipSuggestions.itemId,
          set: {
            itemName: sql`excluded.item_name`,
            currentMargin: sql`excluded.current_margin`,
            marginPercent: sql`excluded.margin_percent`,
            buyPrice: sql`excluded.buy_price`,
            sellPrice: sql`excluded.sell_price`,
            dailyVolume: sql`excluded.daily_volume`,
            profitPotential: sql`excluded.profit_potential`,
            flipQualityGrade: sql`excluded.flip_quality_grade`,
            flipQualityScore: sql`excluded.flip_quality_score`,
            qualityLiquidity: sql`excluded.quality_liquidity`,
            qualityStaleness: sql`excluded.quality_staleness`,
            qualityMarginStability: sql`excluded.quality_margin_stability`,
            qualityVolumeAdequacy: sql`excluded.quality_volume_adequacy`,
            qualityBuyPressure: sql`excluded.quality_buy_pressure`,
            qualityTaxEfficiency: sql`excluded.quality_tax_efficiency`,
            qualityFlags: sql`excluded.quality_flags`,
            calculatedAt: sql`excluded.calculated_at`,
          },
        });

      upserted += batch.length;
    } catch (error) {
      errors += batch.length;
      logger.error(
        { error, batchStart: i, batchSize: batch.length },
        'Failed to upsert flip suggestions batch'
      );
    }
  }

  return { upserted, errors };
}

/**
 * Remove stale flip suggestions that are older than the given age.
 */
export async function pruneStaleFlipSuggestions(
  maxAgeMs: number
): Promise<number> {
  const db = getDbClient();
  const cutoff = new Date(Date.now() - maxAgeMs);

  const deleted = await db
    .delete(geFlipSuggestions)
    .where(sql`${geFlipSuggestions.calculatedAt} < ${cutoff}`)
    .returning({ id: geFlipSuggestions.id });

  return deleted.length;
}
