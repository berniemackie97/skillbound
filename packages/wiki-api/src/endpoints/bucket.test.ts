import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WikiBucketClient } from './bucket';

const createJsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('WikiBucketClient', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns bucket rows from a successful query', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        bucketQuery: "bucket('quest').select('page_name').run()",
        bucket: [{ page_name: "Cook's Assistant" }],
      })
    );

    const client = new WikiBucketClient({
      userAgent: 'Skillbound test',
      retries: 0,
    });
    const results = await client.query(
      "bucket('quest').select('page_name').run()"
    );

    expect(results).toHaveLength(1);
    expect(results[0]?.['page_name']).toBe("Cook's Assistant");
  });

  it('caches bucket queries by default', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        bucket: [{ page_name: 'Cached quest' }],
      })
    );

    const client = new WikiBucketClient({
      userAgent: 'Skillbound test',
      retries: 0,
    });
    const first = await client.query(
      "bucket('quest').select('page_name').run()"
    );
    const second = await client.query(
      "bucket('quest').select('page_name').run()"
    );

    expect(first[0]?.['page_name']).toBe('Cached quest');
    expect(second[0]?.['page_name']).toBe('Cached quest');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws when the bucket API returns an error', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({ error: 'Field name not found in bucket quest.' })
    );

    const client = new WikiBucketClient({
      userAgent: 'Skillbound test',
      retries: 0,
    });

    await expect(
      client.query("bucket('quest').select('name').run()")
    ).rejects.toThrow('Field name not found in bucket quest.');
  });

  it('maps quest rows using page_name and official fields', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        bucket: [
          {
            page_name: "Cook's Assistant",
            description: 'A quick starter quest.',
            official_difficulty: 'Novice',
            official_length: 'Very Short',
            requirements: 'None',
            start_point: 'Talk to the cook.',
            items_required: 'Egg, milk, flour',
            enemies_to_defeat: 'None',
          },
        ],
      })
    );

    const client = new WikiBucketClient({
      userAgent: 'Skillbound test',
      retries: 0,
    });
    const quests = await client.getQuests();

    expect(quests).toHaveLength(1);
    expect(quests[0]?.name).toBe("Cook's Assistant");
    expect(quests[0]?.officialDifficulty).toBe('Novice');
  });

  it('parses item fields including booleans and arrays', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        bucket: [
          {
            item_id: ['4151'],
            item_name: 'Abyssal whip',
            image: ['File:Abyssal whip.png'],
            is_members_only: '',
            tradeable: '',
            high_alchemy_value: 120000,
            value: 120000,
            weight: 0.453,
            buy_limit: 70,
            quest: 'No',
          },
        ],
      })
    );

    const client = new WikiBucketClient({
      userAgent: 'Skillbound test',
      retries: 0,
    });
    const item = await client.getItemById(4151);

    expect(item?.itemId).toBe(4151);
    expect(item?.itemName).toBe('Abyssal whip');
    expect(item?.tradeable).toBe(true);
    expect(item?.isMembersOnly).toBe(true);
    expect(item?.image).toContain('Abyssal whip');
  });

  it('filters invalid item rows when searching', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        bucket: [
          { item_name: 'Invalid item' },
          { item_id: ['123'], item_name: 'Valid item' },
        ],
      })
    );

    const client = new WikiBucketClient({
      userAgent: 'Skillbound test',
      retries: 0,
    });
    const items = await client.searchItems('Valid item');

    expect(items).toHaveLength(1);
    expect(items[0]?.itemId).toBe(123);
  });

  it('handles mixed boolean representations', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        bucket: [
          {
            item_id: '999',
            item_name: 'Test item',
            image: 'File:Test item.png',
            is_members_only: 0,
            tradeable: 'No',
            quest: true,
          },
        ],
      })
    );

    const client = new WikiBucketClient({
      userAgent: 'Skillbound test',
      retries: 0,
    });
    const item = await client.getItemById(999);

    expect(item?.itemId).toBe(999);
    expect(item?.isMembersOnly).toBe(false);
    expect(item?.tradeable).toBe(false);
    expect(item?.quest).toBe('true');
    expect(item?.image).toContain('Test item');
  });

  it('handles array values and numeric parsing fallbacks', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        bucket: [
          {
            item_id: ['1000'],
            item_name: 'Array item',
            tradeable: ['Yes'],
            buy_limit: '',
            value: 'not-a-number',
            quest: false,
          },
        ],
      })
    );

    const client = new WikiBucketClient({
      userAgent: 'Skillbound test',
      retries: 0,
    });
    const item = await client.getItemById(1000);

    expect(item?.tradeable).toBe(true);
    expect(item?.buyLimit).toBeUndefined();
    expect(item?.value).toBeUndefined();
    expect(item?.quest).toBe('false');
  });

  it('returns empty results when bucket data is missing', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(createJsonResponse({}));

    const client = new WikiBucketClient({
      userAgent: 'Skillbound test',
      retries: 0,
    });
    const results = await client.query(
      "bucket('quest').select('page_name').run()"
    );

    expect(results).toHaveLength(0);
  });

  it('returns null when item is not found', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(createJsonResponse({ bucket: [] }));

    const client = new WikiBucketClient({
      userAgent: 'Skillbound test',
      retries: 0,
    });
    const item = await client.getItemById(12345);

    expect(item).toBeNull();
  });

  it('returns null when item name is missing', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        bucket: [
          {
            item_id: '123',
          },
        ],
      })
    );

    const client = new WikiBucketClient({
      userAgent: 'Skillbound test',
      retries: 0,
    });
    const item = await client.getItemById(123);

    expect(item).toBeNull();
  });

  it('filters invalid combat achievements', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        bucket: [
          {
            id: 574,
            name: "You're a wizard",
            monster: 'The Hueycoatl',
            task: 'Kill the Hueycoatl using only earth spells.',
            tier: 'Medium',
            type: 'Restriction',
          },
          {
            name: 'Missing id',
          },
        ],
      })
    );

    const client = new WikiBucketClient({
      userAgent: 'Skillbound test',
      retries: 0,
    });
    const results = await client.getCombatAchievements();

    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe(574);
  });

  it('throws on non-ok HTTP responses', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(createJsonResponse({ error: 'nope' }, 500));

    const client = new WikiBucketClient({
      userAgent: 'Skillbound test',
      retries: 0,
    });

    await expect(
      client.query("bucket('quest').select('page_name').run()")
    ).rejects.toThrow('HTTP 500');
  });
});
