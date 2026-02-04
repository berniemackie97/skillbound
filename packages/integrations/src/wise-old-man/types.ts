import type { z } from 'zod';

import type { CacheAdapter } from '../shared/cache';

import type {
  wiseOldManPlayerSchema,
  wiseOldManSnapshotSchema,
  wiseOldManSnapshotsSchema,
} from './schema';

export type WiseOldManPlayer = z.infer<typeof wiseOldManPlayerSchema>;
export type WiseOldManSnapshot = z.infer<typeof wiseOldManSnapshotSchema>;
export type WiseOldManSnapshots = z.infer<typeof wiseOldManSnapshotsSchema>;

export type WiseOldManClientConfig = {
  baseUrl?: string;
  timeoutMs?: number;
  cache?: CacheAdapter<WiseOldManPlayer> | null;
  cacheTtlMs?: number;
  userAgent?: string;
};

export type WiseOldManClient = {
  getPlayer(username: string): Promise<WiseOldManPlayer>;
  updatePlayer(username: string): Promise<WiseOldManPlayer>;
  getPlayerSnapshots(
    username: string,
    options?: {
      period?: 'day' | 'week' | 'month' | 'year';
      startDate?: string;
      endDate?: string;
    }
  ): Promise<WiseOldManSnapshots>;
};
