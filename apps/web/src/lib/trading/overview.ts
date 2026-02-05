import {
  and,
  characterProfiles,
  eq,
  geTrades,
  geWatchItems,
  sql,
  userCharacters,
} from '@skillbound/database';

import { getDbClient } from '../db';

/**
 * Verify character ownership
 */
export async function verifyCharacterOwnership(
  characterId: string,
  userId: string
): Promise<boolean> {
  const db = getDbClient();

  const [character] = await db
    .select({ id: userCharacters.id })
    .from(userCharacters)
    .where(
      and(eq(userCharacters.id, characterId), eq(userCharacters.userId, userId))
    )
    .limit(1);

  return !!character;
}

/**
 * Get trading statistics overview
 */
export async function getTradingOverview(characterId: string): Promise<{
  totalTrades: number;
  buyTrades: number;
  sellTrades: number;
  totalProfit: number;
  totalVolume: number;
  uniqueItems: number;
  oldestTrade: Date | null;
  newestTrade: Date | null;
  watchListCount: number;
  averageTradeValue: number;
  averageProfitPerTrade: number;
}> {
  const db = getDbClient();

  const [stats] = await db
    .select({
      totalTrades: sql<number>`count(*)`,
      buyTrades: sql<number>`sum(case when trade_type = 'buy' then 1 else 0 end)`,
      sellTrades: sql<number>`sum(case when trade_type = 'sell' then 1 else 0 end)`,
      totalProfit: sql<number>`COALESCE(sum(total_profit), 0)`,
      totalVolume: sql<number>`COALESCE(sum(total_value), 0)`,
      uniqueItems: sql<number>`count(distinct item_id)`,
      oldestTrade: sql<Date>`min(traded_at)`,
      newestTrade: sql<Date>`max(traded_at)`,
      averageTradeValue: sql<number>`COALESCE(avg(total_value), 0)`,
      averageProfitPerTrade: sql<number>`COALESCE(avg(total_profit), 0)`,
    })
    .from(geTrades)
    .where(eq(geTrades.userCharacterId, characterId));

  const [watchCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(geWatchItems)
    .where(
      and(
        eq(geWatchItems.userCharacterId, characterId),
        eq(geWatchItems.isActive, true)
      )
    );

  return {
    totalTrades: Number(stats?.totalTrades ?? 0),
    buyTrades: Number(stats?.buyTrades ?? 0),
    sellTrades: Number(stats?.sellTrades ?? 0),
    totalProfit: Number(stats?.totalProfit ?? 0),
    totalVolume: Number(stats?.totalVolume ?? 0),
    uniqueItems: Number(stats?.uniqueItems ?? 0),
    oldestTrade: stats?.oldestTrade ?? null,
    newestTrade: stats?.newestTrade ?? null,
    watchListCount: Number(watchCount?.count ?? 0),
    averageTradeValue: Number(stats?.averageTradeValue ?? 0),
    averageProfitPerTrade: Number(stats?.averageProfitPerTrade ?? 0),
  };
}

export async function getUserTradingOverview(userId: string): Promise<{
  totalTrades: number;
  buyTrades: number;
  sellTrades: number;
  totalProfit: number;
  totalVolume: number;
  uniqueItems: number;
  oldestTrade: Date | null;
  newestTrade: Date | null;
  watchListCount: number;
  averageTradeValue: number;
  averageProfitPerTrade: number;
}> {
  const db = getDbClient();

  const [stats] = await db
    .select({
      totalTrades: sql<number>`count(*)`,
      buyTrades: sql<number>`sum(case when trade_type = 'buy' then 1 else 0 end)`,
      sellTrades: sql<number>`sum(case when trade_type = 'sell' then 1 else 0 end)`,
      totalProfit: sql<number>`COALESCE(sum(total_profit), 0)`,
      totalVolume: sql<number>`COALESCE(sum(total_value), 0)`,
      uniqueItems: sql<number>`count(distinct item_id)`,
      oldestTrade: sql<Date>`min(traded_at)`,
      newestTrade: sql<Date>`max(traded_at)`,
      averageTradeValue: sql<number>`COALESCE(avg(total_value), 0)`,
      averageProfitPerTrade: sql<number>`COALESCE(avg(total_profit), 0)`,
    })
    .from(geTrades)
    .innerJoin(userCharacters, eq(geTrades.userCharacterId, userCharacters.id))
    .innerJoin(
      characterProfiles,
      eq(userCharacters.profileId, characterProfiles.id)
    )
    .where(
      and(
        eq(userCharacters.userId, userId),
        eq(characterProfiles.mode, 'normal')
      )
    );

  const [watchCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(geWatchItems)
    .innerJoin(
      userCharacters,
      eq(geWatchItems.userCharacterId, userCharacters.id)
    )
    .innerJoin(
      characterProfiles,
      eq(userCharacters.profileId, characterProfiles.id)
    )
    .where(
      and(
        eq(userCharacters.userId, userId),
        eq(characterProfiles.mode, 'normal'),
        eq(geWatchItems.isActive, true)
      )
    );

  return {
    totalTrades: Number(stats?.totalTrades ?? 0),
    buyTrades: Number(stats?.buyTrades ?? 0),
    sellTrades: Number(stats?.sellTrades ?? 0),
    totalProfit: Number(stats?.totalProfit ?? 0),
    totalVolume: Number(stats?.totalVolume ?? 0),
    uniqueItems: Number(stats?.uniqueItems ?? 0),
    oldestTrade: stats?.oldestTrade ?? null,
    newestTrade: stats?.newestTrade ?? null,
    watchListCount: Number(watchCount?.count ?? 0),
    averageTradeValue: Number(stats?.averageTradeValue ?? 0),
    averageProfitPerTrade: Number(stats?.averageProfitPerTrade ?? 0),
  };
}
