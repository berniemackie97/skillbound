import { describe, expect, it } from 'vitest';

import {
  WikiBucketClient,
  WikiPricesClient,
  WikiSearchClient,
  createWikiBucketClient,
  createWikiPricesClient,
  createWikiSearchClient,
} from './index';

describe('wiki-api index exports', () => {
  it('exports factory helpers', () => {
    const bucket = createWikiBucketClient('Skillbound test', { retries: 0 });
    const prices = createWikiPricesClient('Skillbound test', { retries: 0 });
    const search = createWikiSearchClient('Skillbound test', { retries: 0 });

    expect(bucket).toBeInstanceOf(WikiBucketClient);
    expect(prices).toBeInstanceOf(WikiPricesClient);
    expect(search).toBeInstanceOf(WikiSearchClient);
  });
});
