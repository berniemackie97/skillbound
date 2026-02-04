import type { z } from 'zod';

import type { CacheAdapter } from '../shared/cache';

import type { osrsboxItemSchema, osrsboxMonsterSchema } from './schema';

export type OsrsBoxItem = z.infer<typeof osrsboxItemSchema>;
export type OsrsBoxMonster = z.infer<typeof osrsboxMonsterSchema>;

export type OsrsBoxClientConfig = {
  baseUrl?: string;
  timeoutMs?: number;
  cache?: CacheAdapter<unknown> | null;
  cacheTtlMs?: number;
  userAgent?: string;
};

export type OsrsBoxClient = {
  getItem(id: number): Promise<OsrsBoxItem>;
  getItems(ids: number[]): Promise<OsrsBoxItem[]>;
  getMonster(id: number): Promise<OsrsBoxMonster>;
  getMonsters(ids: number[]): Promise<OsrsBoxMonster[]>;
};
