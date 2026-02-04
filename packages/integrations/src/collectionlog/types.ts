import type { z } from 'zod';

import type { CacheAdapter } from '../shared/cache';

import type { collectionLogUserResponseSchema } from './schema';

export type CollectionLogUserResponse = z.infer<
  typeof collectionLogUserResponseSchema
>;

export type CollectionLogClientConfig = {
  baseUrl?: string;
  timeoutMs?: number;
  cache?: CacheAdapter<CollectionLogUserResponse> | null;
  cacheTtlMs?: number;
  userAgent?: string;
};

export type CollectionLogClient = {
  getUserCollectionLog(username: string): Promise<CollectionLogUserResponse>;
};
