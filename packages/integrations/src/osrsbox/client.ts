import pRetry from 'p-retry';
import { z } from 'zod';

import { buildCacheKey } from '../shared/cache';
import { HttpError, ParseError } from '../shared/errors';
import { fetchJson } from '../shared/http';

import { osrsboxItemSchema, osrsboxMonsterSchema } from './schema';
import type {
  OsrsBoxClient,
  OsrsBoxClientConfig,
  OsrsBoxItem,
  OsrsBoxMonster,
} from './types';

export class OsrsBoxNotFoundError extends Error {
  readonly id: number;
  readonly kind: 'item' | 'monster';

  constructor(kind: 'item' | 'monster', id: number) {
    super(`OSRSBox ${kind} not found: ${id}`);
    this.name = 'OsrsBoxNotFoundError';
    this.id = id;
    this.kind = kind;
  }
}

export class OsrsBoxServerError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'OsrsBoxServerError';
    this.status = status;
  }
}

const DEFAULT_BASE_URL = 'https://www.osrsbox.com/osrsbox-db';

function buildItemUrl(baseUrl: string, id: number) {
  return `${baseUrl}/items-json/${id}.json`;
}

function buildMonsterUrl(baseUrl: string, id: number) {
  return `${baseUrl}/monsters-json/${id}.json`;
}

function getCacheKey(prefix: string, id: number): string {
  return buildCacheKey(['osrsbox', prefix, id]);
}

async function fetchOsrsBox<T>(options: {
  url: string;
  timeoutMs: number;
  userAgent?: string;
  schema: (value: unknown) => T;
  notFound: () => Error;
}): Promise<T> {
  return pRetry(
    async () => {
      try {
        const headers = options.userAgent
          ? { 'user-agent': options.userAgent }
          : undefined;
        const data = await fetchJson({
          url: options.url,
          timeoutMs: options.timeoutMs,
          ...(headers ? { headers } : {}),
        });

        return options.schema(data);
      } catch (error) {
        if (error instanceof HttpError) {
          if (error.status === 404) {
            throw options.notFound();
          }
          throw new OsrsBoxServerError(error.status, error.message);
        }

        if (error instanceof z.ZodError) {
          throw new ParseError(
            'OSRSBox response validation failed',
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
        if (error instanceof OsrsBoxNotFoundError) {
          return false;
        }
        if (error instanceof OsrsBoxServerError) {
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

export function createOsrsBoxClient(
  config: OsrsBoxClientConfig = {}
): OsrsBoxClient {
  const baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
  const timeoutMs = config.timeoutMs ?? 15_000;
  const cache = config.cache ?? null;
  const cacheTtlMs = config.cacheTtlMs ?? 24 * 60 * 60 * 1000;
  const userAgent = config.userAgent;

  async function getCached<T>(key: string): Promise<T | null> {
    if (!cache) {
      return null;
    }
    const cached = await cache.get(key);
    return (cached as T | null) ?? null;
  }

  async function setCached<T>(key: string, value: T) {
    if (cache) {
      await cache.set(key, value, cacheTtlMs);
    }
  }

  async function getItem(id: number): Promise<OsrsBoxItem> {
    const cacheKey = getCacheKey('item', id);
    const cached = await getCached<OsrsBoxItem>(cacheKey);
    if (cached) {
      return cached;
    }

    const item = await fetchOsrsBox({
      url: buildItemUrl(baseUrl, id),
      timeoutMs,
      schema: (value) => osrsboxItemSchema.parse(value),
      notFound: () => new OsrsBoxNotFoundError('item', id),
      ...(userAgent ? { userAgent } : {}),
    });

    await setCached(cacheKey, item);
    return item;
  }

  async function getItems(ids: number[]): Promise<OsrsBoxItem[]> {
    const results: OsrsBoxItem[] = [];
    for (const id of ids) {
      results.push(await getItem(id));
    }
    return results;
  }

  async function getMonster(id: number): Promise<OsrsBoxMonster> {
    const cacheKey = getCacheKey('monster', id);
    const cached = await getCached<OsrsBoxMonster>(cacheKey);
    if (cached) {
      return cached;
    }

    const monster = await fetchOsrsBox({
      url: buildMonsterUrl(baseUrl, id),
      timeoutMs,
      schema: (value) => osrsboxMonsterSchema.parse(value),
      notFound: () => new OsrsBoxNotFoundError('monster', id),
      ...(userAgent ? { userAgent } : {}),
    });

    await setCached(cacheKey, monster);
    return monster;
  }

  async function getMonsters(ids: number[]): Promise<OsrsBoxMonster[]> {
    const results: OsrsBoxMonster[] = [];
    for (const id of ids) {
      results.push(await getMonster(id));
    }
    return results;
  }

  return { getItem, getItems, getMonster, getMonsters };
}

export type {
  OsrsBoxClient,
  OsrsBoxClientConfig,
  OsrsBoxItem,
  OsrsBoxMonster,
} from './types';
