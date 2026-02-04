import { MemoryCache, type CacheAdapter } from '@skillbound/cache';
import pRetry from 'p-retry';
import { z } from 'zod';

export interface WikiSearchResult {
  searchTerm: string;
  titles: string[];
  descriptions: string[];
  urls: string[];
}

export interface WikiSearchClientConfig {
  userAgent: string;
  retries?: number;
  timeoutMs?: number;
  cache?: CacheAdapter<WikiSearchResult> | null;
  cacheTtlMs?: number;
}

const OpenSearchSchema = z.tuple([
  z.string(),
  z.array(z.string()),
  z.array(z.string()),
  z.array(z.string()),
]);

export class WikiSearchClient {
  private readonly baseUrl = 'https://oldschool.runescape.wiki/api.php';
  private readonly userAgent: string;
  private readonly retries: number;
  private readonly timeoutMs: number;
  private readonly cache: CacheAdapter<WikiSearchResult> | null;
  private readonly cacheTtlMs: number;

  constructor(config: WikiSearchClientConfig) {
    this.userAgent = config.userAgent;
    this.retries = config.retries ?? 3;
    this.timeoutMs = config.timeoutMs ?? 10000;
    this.cache = config.cache ?? new MemoryCache<WikiSearchResult>();
    this.cacheTtlMs = config.cacheTtlMs ?? 10 * 60 * 1000;
  }

  async search(
    query: string,
    options: { limit?: number; namespace?: number } = {}
  ): Promise<WikiSearchResult> {
    const limit = options.limit ?? 10;
    const namespace = options.namespace ?? 0;

    const url = `${this.baseUrl}?action=opensearch&search=${encodeURIComponent(
      query
    )}&limit=${limit}&namespace=${namespace}&format=json`;
    const cacheKey = `search:${query}:${limit}:${namespace}`;

    if (this.cache) {
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const result = await pRetry(
      async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'User-Agent': this.userAgent,
            Accept: 'application/json',
          },
        }).finally(() => clearTimeout(timeoutId));

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const json = await response.json();
        const parsed = OpenSearchSchema.parse(json);

        return {
          searchTerm: parsed[0],
          titles: parsed[1],
          descriptions: parsed[2],
          urls: parsed[3],
        };
      },
      {
        retries: this.retries,
        onFailedAttempt: ({ error, attemptNumber }) => {
          console.warn(
            `OpenSearch attempt ${attemptNumber} failed:`,
            error.message
          );
        },
      }
    );

    if (this.cache) {
      await this.cache.set(cacheKey, result, this.cacheTtlMs);
    }

    return result;
  }
}

export function createWikiSearchClient(
  userAgent: string,
  options?: {
    retries?: number;
    timeoutMs?: number;
    cache?: CacheAdapter<WikiSearchResult> | null;
    cacheTtlMs?: number;
  }
): WikiSearchClient {
  return new WikiSearchClient({ userAgent, ...options });
}
