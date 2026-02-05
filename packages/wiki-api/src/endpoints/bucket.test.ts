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
            ironman_concerns: 'Bank access recommended.',
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
    expect(quests[0]?.ironmanConcerns).toBe('Bank access recommended.');
  });

  it('filters quest rows that are missing page_name', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        bucket: [{ description: 'Missing name' }, { page_name: 'Valid quest' }],
      })
    );

    const client = new WikiBucketClient({
      userAgent: 'Skillbound test',
      retries: 0,
    });
    const quests = await client.getQuests();

    expect(quests).toHaveLength(1);
    expect(quests[0]?.name).toBe('Valid quest');
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
            examine: 'A weapon from the abyss.',
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

  it('maps optional fields when searching items', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        bucket: [
          {
            item_id: '42',
            item_name: 'Search item',
            image: 'File:Search item.png',
            is_members_only: 'Yes',
            examine: 'A searched item.',
            high_alchemy_value: '200',
            value: '150',
            weight: '1.5',
            buy_limit: '10',
            tradeable: 'Yes',
          },
        ],
      })
    );

    const client = new WikiBucketClient({
      userAgent: 'Skillbound test',
      retries: 0,
    });
    const items = await client.searchItems('Search item');

    expect(items).toHaveLength(1);
    expect(items[0]?.image).toContain('Search item');
    expect(items[0]?.buyLimit).toBe(10);
    expect(items[0]?.tradeable).toBe(true);
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

  it('skips cache when cache is null', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        createJsonResponse({ bucket: [{ page_name: 'No cache quest' }] })
      )
    );

    const client = new WikiBucketClient({
      userAgent: 'Skillbound test',
      retries: 0,
      cache: null,
    });

    await client.query("bucket('quest').select('page_name').run()");
    await client.query("bucket('quest').select('page_name').run()");

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('maps monster fields from bucket data', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        bucket: [
          {
            name: 'Abyssal demon',
            version: 'Variant',
            combat: '124',
            hitpoints: 150,
            max_hit: '8',
            attack_style: 'Melee',
            attack_speed: 4,
            aggressive: 'yes',
            poisonous: 0,
            immune_poison: 'no',
            immune_venom: 1,
            slaylvl: 85,
            slayxp: 150,
            cat: 'Abyssal',
            assigned_by: 'Duradel',
            att: 97,
            str: 99,
            def: 89,
            mage: 1,
            range: 1,
            attbns: 60,
            strbns: 75,
            dstab: 50,
            dslash: 60,
            dcrush: 40,
            dmage: 30,
            drange: 35,
            examine: 'A demon of the abyss.',
          },
        ],
      })
    );

    const client = new WikiBucketClient({
      userAgent: 'Skillbound test',
      retries: 0,
    });
    const monster = await client.getMonster('Abyssal demon');

    expect(monster?.name).toBe('Abyssal demon');
    expect(monster?.combatLevel).toBe(124);
    expect(monster?.aggressive).toBe(true);
    expect(monster?.poisonous).toBe(false);
    expect(monster?.immunePoison).toBe(false);
    expect(monster?.immuneVenom).toBe(true);
    expect(monster?.slayerLevel).toBe(85);
  });

  it('returns null when monster results are empty', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(createJsonResponse({ bucket: [] }));

    const client = new WikiBucketClient({
      userAgent: 'Skillbound test',
      retries: 0,
    });
    const monster = await client.getMonster('Ghost');

    expect(monster).toBeNull();
  });

  it('returns null when monster name is missing', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        bucket: [
          {
            combat: 100,
          },
        ],
      })
    );

    const client = new WikiBucketClient({
      userAgent: 'Skillbound test',
      retries: 0,
    });
    const monster = await client.getMonster('Nameless');

    expect(monster).toBeNull();
  });

  it('filters invalid monster rows on search', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        bucket: [{ combat: 42 }, { name: 'Abyssal sire', combat: 350 }],
      })
    );

    const client = new WikiBucketClient({
      userAgent: 'Skillbound test',
      retries: 0,
    });
    const monsters = await client.searchMonsters('Abyssal');

    expect(monsters).toHaveLength(1);
    expect(monsters[0]?.name).toBe('Abyssal sire');
  });

  it('maps optional fields when searching monsters', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        bucket: [
          {
            name: "Kalp'ite Queen",
            version: '2',
            combat: 333,
            hitpoints: 255,
            slaylvl: 0,
            cat: 'Kalphite',
            examine: 'Large and in charge.',
          },
        ],
      })
    );

    const client = new WikiBucketClient({
      userAgent: 'Skillbound test',
      retries: 0,
    });
    const monsters = await client.searchMonsters('Kalphite');

    expect(monsters).toHaveLength(1);
    expect(monsters[0]?.version).toBe('2');
    expect(monsters[0]?.slayerCategory).toBe('Kalphite');
  });

  it('maps equipment bonuses from bucket data', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        bucket: [
          {
            item_id: '12926',
            item_name: 'Toxic blowpipe',
            slot: 'Weapon',
            astab: 0,
            aslash: 0,
            acrush: 0,
            amagic: -50,
            arange: 30,
            dstab: 0,
            dslash: 0,
            dcrush: 0,
            dmagic: 0,
            drange: 0,
            str: 0,
            rstr: 20,
            mdmg: 0,
            prayer: 0,
            aspeed: 2,
          },
        ],
      })
    );

    const client = new WikiBucketClient({
      userAgent: 'Skillbound test',
      retries: 0,
    });
    const bonuses = await client.getEquipmentBonuses('Toxic blowpipe');

    expect(bonuses?.itemId).toBe(12926);
    expect(bonuses?.itemName).toBe('Toxic blowpipe');
    expect(bonuses?.rangeAttack).toBe(30);
    expect(bonuses?.rangeStrengthBonus).toBe(20);
    expect(bonuses?.attackSpeed).toBe(2);
  });

  it('returns null for equipment bonuses when bucket is empty', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(createJsonResponse({ bucket: [] }));

    const client = new WikiBucketClient({
      userAgent: 'Skillbound test',
      retries: 0,
    });
    const bonuses = await client.getEquipmentBonuses('None');

    expect(bonuses).toBeNull();
  });

  it('returns null for equipment bonuses when required fields are missing', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        bucket: [{ item_name: 'Missing id' }],
      })
    );

    const client = new WikiBucketClient({
      userAgent: 'Skillbound test',
      retries: 0,
    });
    const bonuses = await client.getEquipmentBonuses('Missing id');

    expect(bonuses).toBeNull();
  });

  it('maps spells and applies spellbook filters', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        bucket: [
          {
            name: 'Fire Bolt',
            spellbook: 'Standard',
            level: 35,
            type: 'Combat',
            max_hit: 12,
            base_xp: 22.5,
            runes: 'Fire rune, air rune, chaos rune',
            description: 'A basic fire spell.',
          },
        ],
      })
    );

    const client = new WikiBucketClient({
      userAgent: 'Skillbound test',
      retries: 0,
    });
    const spells = await client.getSpells('Standard');

    expect(spells).toHaveLength(1);
    expect(spells[0]?.name).toBe('Fire Bolt');
    expect(spells[0]?.levelRequired).toBe(35);
    const expectedFilter = encodeURIComponent("where('spellbook','Standard')");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(expectedFilter),
      expect.any(Object)
    );
  });

  it('uses the default spell query when no spellbook is provided', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        bucket: [
          {
            name: 'Wind Strike',
            spellbook: 'Standard',
            level: 1,
          },
        ],
      })
    );

    const client = new WikiBucketClient({
      userAgent: 'Skillbound test',
      retries: 0,
    });
    const spells = await client.getSpells();

    expect(spells[0]?.name).toBe('Wind Strike');
    const forbiddenFilter = encodeURIComponent("where('spellbook'");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.not.stringContaining(forbiddenFilter),
      expect.any(Object)
    );
  });

  it('handles unknown boolean and object string values', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        bucket: [
          {
            item_id: '777',
            item_name: 'Odd item',
            is_members_only: 'maybe',
            tradeable: [],
            examine: { detail: 'unknown' },
            value: '100',
            buy_limit: '',
          },
        ],
      })
    );

    const client = new WikiBucketClient({
      userAgent: 'Skillbound test',
      retries: 0,
    });
    const item = await client.getItemById(777);

    expect(item?.isMembersOnly).toBe(true);
    expect(item?.tradeable).toBe(false);
    expect(item?.examine).toBeUndefined();
    expect(item?.value).toBe(100);
    expect(item?.buyLimit).toBeUndefined();
  });

  it('handles boolean fields and ignores unsupported types', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        bucket: [
          {
            item_id: '888',
            item_name: 'Boolean item',
            tradeable: true,
            is_members_only: { value: 'unexpected' },
          },
        ],
      })
    );

    const client = new WikiBucketClient({
      userAgent: 'Skillbound test',
      retries: 0,
    });
    const item = await client.getItemById(888);

    expect(item?.tradeable).toBe(true);
    expect(item?.isMembersOnly).toBeUndefined();
  });

  it('maps activity data from bucket rows', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        bucket: [
          {
            name: 'Barbarian Assault',
            type: 'Minigame',
            participants: '2-5',
            skills: 'Combat',
            rewards: 'Penance armor',
            location: 'Barbarian Outpost',
            requirements: 'None',
          },
        ],
      })
    );

    const client = new WikiBucketClient({
      userAgent: 'Skillbound test',
      retries: 0,
    });
    const activities = await client.getActivities();

    expect(activities).toHaveLength(1);
    expect(activities[0]?.name).toBe('Barbarian Assault');
    expect(activities[0]?.location).toBe('Barbarian Outpost');
  });
});
