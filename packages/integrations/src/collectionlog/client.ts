import pRetry from 'p-retry';
import { z } from 'zod';

import { buildCacheKey } from '../shared/cache';
import { HttpError, ParseError } from '../shared/errors';
import { fetchJson } from '../shared/http';

import {
  collectionLogErrorSchema,
  collectionLogUserResponseSchema,
} from './schema';
import type {
  CollectionLogClient,
  CollectionLogClientConfig,
  CollectionLogUserResponse,
} from './types';

export class CollectionLogNotFoundError extends Error {
  readonly username: string;

  constructor(username: string) {
    super(`Collection log not found for ${username}`);
    this.name = 'CollectionLogNotFoundError';
    this.username = username;
  }
}

export class CollectionLogRateLimitError extends Error {
  constructor() {
    super('Collection log API rate limit exceeded');
    this.name = 'CollectionLogRateLimitError';
  }
}

export class CollectionLogServerError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'CollectionLogServerError';
    this.status = status;
  }
}

const DEFAULT_BASE_URL = 'https://api.collectionlog.net/collectionlog';

function buildUserUrl(baseUrl: string, username: string): string {
  return `${baseUrl}/user/${encodeURIComponent(username)}`;
}

function getCacheKey(username: string): string {
  return buildCacheKey(['collectionlog', username.toLowerCase()]);
}

async function requestCollectionLog(options: {
  baseUrl: string;
  username: string;
  timeoutMs: number;
  userAgent?: string;
}): Promise<CollectionLogUserResponse> {
  return pRetry(
    async () => {
      try {
        const headers = options.userAgent
          ? { 'user-agent': options.userAgent }
          : undefined;
        const data = await fetchJson({
          url: buildUserUrl(options.baseUrl, options.username),
          timeoutMs: options.timeoutMs,
          ...(headers ? { headers } : {}),
        });

        return collectionLogUserResponseSchema.parse(data);
      } catch (error) {
        if (error instanceof HttpError) {
          if (error.status === 404) {
            throw new CollectionLogNotFoundError(options.username);
          }
          if (error.status === 429) {
            throw new CollectionLogRateLimitError();
          }
          if (error.body) {
            try {
              const parsed = collectionLogErrorSchema.safeParse(
                JSON.parse(error.body)
              );
              if (
                parsed.success &&
                (parsed.data.message || parsed.data.error)
              ) {
                throw new CollectionLogServerError(
                  error.status,
                  parsed.data.message ?? parsed.data.error ?? error.message
                );
              }
            } catch {
              // Ignore JSON parse errors.
            }
          }
          throw new CollectionLogServerError(error.status, error.message);
        }

        if (error instanceof z.ZodError) {
          throw new ParseError(
            'Collection log response validation failed',
            error.message
          );
        }

        throw error;
      }
    },
    {
      retries: 2,
      factor: 2,
      minTimeout: 400,
      maxTimeout: 2000,
      onFailedAttempt: () => {},
      shouldRetry: ({ error }) => {
        if (error instanceof CollectionLogNotFoundError) {
          return false;
        }
        if (error instanceof CollectionLogRateLimitError) {
          return true;
        }
        if (error instanceof CollectionLogServerError) {
          return error.status >= 500;
        }
        if (error instanceof ParseError) {
          return false;
        }
        return true;
      },
    }
  );
}

export function createCollectionLogClient(
  config: CollectionLogClientConfig = {}
): CollectionLogClient {
  const baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
  const timeoutMs = config.timeoutMs ?? 10_000;
  const cache = config.cache ?? null;
  const cacheTtlMs = config.cacheTtlMs ?? 10 * 60 * 1000;
  const userAgent = config.userAgent;

  async function getUserCollectionLog(
    username: string
  ): Promise<CollectionLogUserResponse> {
    const cacheKey = getCacheKey(username);
    const cached = cache ? await cache.get(cacheKey) : null;
    if (cached) {
      return cached;
    }

    const data = await requestCollectionLog({
      baseUrl,
      username,
      timeoutMs,
      ...(userAgent ? { userAgent } : {}),
    });

    if (cache) {
      await cache.set(cacheKey, data, cacheTtlMs);
    }

    return data;
  }

  return { getUserCollectionLog };
}

export type { CollectionLogUserResponse } from './types';
