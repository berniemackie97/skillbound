/**
 * GET /api/ge/risk-metrics
 *
 * Authenticated endpoint that computes risk metrics (Sharpe, Sortino,
 * max drawdown, profit factor, win rate, streaks, grade) from the
 * user's completed sell trades (which carry profit/loss data).
 */

import { NextResponse } from 'next/server';

import { getSessionUser, unauthorizedResponse } from '@/lib/auth/auth-helpers';
import { getTradableCharacters } from '@/lib/character/character-selection';
import {
  calculateRiskMetrics,
  type TradeResult,
} from '@/lib/trading/risk-metrics';
import { getCharacterTrades } from '@/lib/trading/trading-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorizedResponse();

  const tradable = await getTradableCharacters(user.id);
  const first = tradable[0];
  if (!first) {
    return NextResponse.json({
      data: calculateRiskMetrics([]),
    });
  }

  // Fetch all sell trades (which have profit data from FIFO matching)
  const { trades } = await getCharacterTrades(first.id, {
    tradeType: 'sell',
    limit: 5000,
  });

  // Map sell trades to TradeResult — totalProfit is the realised P&L
  const tradeResults: TradeResult[] = trades
    .filter((t) => t.totalProfit !== null)
    .map((t) => ({
      profit: t.totalProfit!,
      tradedAt: t.tradedAt,
    }));

  const metrics = calculateRiskMetrics(tradeResults);

  return NextResponse.json(
    {
      data: metrics,
      meta: { characterId: first.id, tradeCount: tradeResults.length },
    },
    {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    }
  );
}
