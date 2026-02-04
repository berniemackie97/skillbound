import type { z } from 'zod';

import type { CacheAdapter } from '../shared/cache';

import type {
  templePlayerDatapointsSchema,
  templePlayerGainsSchema,
  templePlayerInfoSchema,
  templePlayerStatsSchema,
} from './schema';

export type TemplePlayerInfo = z.infer<typeof templePlayerInfoSchema>;
export type TemplePlayerStats = z.infer<typeof templePlayerStatsSchema>;
export type TemplePlayerGains = z.infer<typeof templePlayerGainsSchema>;
export type TemplePlayerDatapoints = z.infer<
  typeof templePlayerDatapointsSchema
>;

export type TempleGainsPeriod = 'day' | 'week' | 'month' | 'year' | 'custom';

export type TempleClientConfig = {
  baseUrl?: string;
  timeoutMs?: number;
  cache?: CacheAdapter<unknown> | null;
  cacheTtlMs?: number;
  userAgent?: string;
};

export type TempleClient = {
  getPlayerInfo(username: string): Promise<TemplePlayerInfo>;
  getPlayerStats(username: string): Promise<TemplePlayerStats>;
  getPlayerGains(
    username: string,
    period?: TempleGainsPeriod
  ): Promise<TemplePlayerGains>;
  getPlayerDatapoints(
    username: string,
    interval?: string
  ): Promise<TemplePlayerDatapoints>;
};
