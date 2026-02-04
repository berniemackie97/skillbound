import { MemoryCache, type CacheAdapter } from '@skillbound/cache';
import pRetry from 'p-retry';
import { z } from 'zod';

/**
 * OSRS Wiki Bucket API Client
 * Documentation: https://oldschool.runescape.wiki/w/RuneScape:Bucket
 */

export interface BucketClientConfig {
  userAgent: string;
  retries?: number;
  timeoutMs?: number;
  cache?: CacheAdapter<BucketResult> | null;
  cacheTtlMs?: number;
}

/**
 * Generic bucket query result
 */
export type BucketResult = Record<string, unknown>[];

/**
 * Quest data from bucket
 */
export interface Quest {
  name: string;
  description?: string | undefined;
  officialDifficulty?: string | undefined;
  officialLength?: string | undefined;
  requirements?: string | undefined;
  startPoint?: string | undefined;
  itemsRequired?: string | undefined;
  enemiesToDefeat?: string | undefined;
  ironmanConcerns?: string | undefined;
}

/**
 * Item data from bucket
 */
export interface Item {
  itemId: number;
  itemName: string;
  image?: string | undefined;
  isMembersOnly?: boolean | undefined;
  examine?: string | undefined;
  highAlchemyValue?: number | undefined;
  value?: number | undefined;
  weight?: number | undefined;
  buyLimit?: number | undefined;
  tradeable?: boolean | undefined;
  quest?: string | undefined;
}

/**
 * Combat achievement data
 */
export interface CombatAchievement {
  id: number;
  name: string;
  monster?: string | undefined;
  task: string;
  tier: 'Easy' | 'Medium' | 'Hard' | 'Elite' | 'Master' | 'Grandmaster';
  type?: string | undefined;
}

const BucketResponseSchema = z.object({
  bucketQuery: z.string().optional(),
  bucket: z.array(z.record(z.string(), z.unknown())).optional(),
  error: z.string().optional(),
});

function unwrapBucketValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function toStringValue(value: unknown): string | undefined {
  const raw = unwrapBucketValue(value);
  if (raw === undefined || raw === null) {
    return undefined;
  }
  if (typeof raw === 'string') {
    return raw;
  }
  if (typeof raw === 'number' || typeof raw === 'boolean') {
    return String(raw);
  }
  return undefined;
}

function toNumberValue(value: unknown): number | undefined {
  const raw = unwrapBucketValue(value);
  if (raw === undefined || raw === null || raw === '') {
    return undefined;
  }
  const numberValue = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function toBooleanValue(value: unknown): boolean | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === '') {
      return true;
    }
    if (normalized === 'yes' || normalized === 'true' || normalized === '1') {
      return true;
    }
    if (normalized === 'no' || normalized === 'false' || normalized === '0') {
      return false;
    }
    return true;
  }

  return undefined;
}

/**
 * OSRS Wiki Bucket API client for structured game data
 */
export class WikiBucketClient {
  private readonly baseUrl = 'https://oldschool.runescape.wiki/api.php';
  private readonly userAgent: string;
  private readonly retries: number;
  private readonly timeoutMs: number;
  private readonly cache: CacheAdapter<BucketResult> | null;
  private readonly cacheTtlMs: number;

  constructor(config: BucketClientConfig) {
    this.userAgent = config.userAgent;
    this.retries = config.retries ?? 3;
    this.timeoutMs = config.timeoutMs ?? 10000;
    this.cache = config.cache ?? new MemoryCache<BucketResult>();
    this.cacheTtlMs = config.cacheTtlMs ?? 10 * 60 * 1000;
  }

  /**
   * Execute a raw bucket query
   */
  async query(query: string): Promise<BucketResult> {
    const url = `${this.baseUrl}?action=bucket&format=json&query=${encodeURIComponent(
      query
    )}`;
    const cacheKey = `bucket:${Buffer.from(query).toString('base64')}`;

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
        const parsed = BucketResponseSchema.parse(json);

        if (parsed.error) {
          throw new Error(parsed.error);
        }

        return parsed.bucket ?? [];
      },
      {
        retries: this.retries,
        onFailedAttempt: ({ error, attemptNumber }) => {
          console.warn(
            `Bucket query attempt ${attemptNumber} failed:`,
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

  /**
   * Get all quests
   */
  async getQuests(): Promise<Quest[]> {
    const query =
      "bucket('quest').select('page_name','description','official_difficulty','official_length','requirements','start_point','items_required','enemies_to_defeat','ironman_concerns').run()";

    const results = await this.query(query);

    return results
      .map((row) => {
        const name = toStringValue(row['page_name']);
        if (!name) {
          return null;
        }

        const quest: Quest = { name };
        const description = toStringValue(row['description']);
        if (description) {
          quest.description = description;
        }
        const officialDifficulty = toStringValue(row['official_difficulty']);
        if (officialDifficulty) {
          quest.officialDifficulty = officialDifficulty;
        }
        const officialLength = toStringValue(row['official_length']);
        if (officialLength) {
          quest.officialLength = officialLength;
        }
        const requirements = toStringValue(row['requirements']);
        if (requirements) {
          quest.requirements = requirements;
        }
        const startPoint = toStringValue(row['start_point']);
        if (startPoint) {
          quest.startPoint = startPoint;
        }
        const itemsRequired = toStringValue(row['items_required']);
        if (itemsRequired) {
          quest.itemsRequired = itemsRequired;
        }
        const enemiesToDefeat = toStringValue(row['enemies_to_defeat']);
        if (enemiesToDefeat) {
          quest.enemiesToDefeat = enemiesToDefeat;
        }
        const ironmanConcerns = toStringValue(row['ironman_concerns']);
        if (ironmanConcerns) {
          quest.ironmanConcerns = ironmanConcerns;
        }

        return quest;
      })
      .filter((quest): quest is Quest => quest !== null);
  }

  /**
   * Get item by ID
   */
  async getItemById(itemId: number): Promise<Item | null> {
    const query = `bucket('infobox_item').select('item_id','item_name','image','is_members_only','examine','high_alchemy_value','value','weight','buy_limit','tradeable','quest').where('item_id','${itemId}').run()`;

    const results = await this.query(query);

    if (results.length === 0) {
      return null;
    }

    const row = results[0];
    if (!row) {
      return null;
    }

    const parsedItemId = toNumberValue(row['item_id']);
    const itemName = toStringValue(row['item_name']);
    if (!itemName) {
      return null;
    }

    const item: Item = {
      itemId: parsedItemId ?? itemId,
      itemName,
    };

    const image = toStringValue(row['image']);
    if (image) {
      item.image = image;
    }
    const isMembersOnly = toBooleanValue(row['is_members_only']);
    if (isMembersOnly !== undefined) {
      item.isMembersOnly = isMembersOnly;
    }
    const examine = toStringValue(row['examine']);
    if (examine) {
      item.examine = examine;
    }
    const highAlchemyValue = toNumberValue(row['high_alchemy_value']);
    if (highAlchemyValue !== undefined) {
      item.highAlchemyValue = highAlchemyValue;
    }
    const value = toNumberValue(row['value']);
    if (value !== undefined) {
      item.value = value;
    }
    const weight = toNumberValue(row['weight']);
    if (weight !== undefined) {
      item.weight = weight;
    }
    const buyLimit = toNumberValue(row['buy_limit']);
    if (buyLimit !== undefined) {
      item.buyLimit = buyLimit;
    }
    const tradeable = toBooleanValue(row['tradeable']);
    if (tradeable !== undefined) {
      item.tradeable = tradeable;
    }
    const quest = toStringValue(row['quest']);
    if (quest) {
      item.quest = quest;
    }

    return item;
  }

  /**
   * Fetch items by exact name (bucket does not support fuzzy matching).
   */
  async searchItems(name: string): Promise<Item[]> {
    const query = `bucket('infobox_item').select('item_id','item_name','image','is_members_only','examine','high_alchemy_value','value','weight','buy_limit','tradeable').where('item_name','${name}').run()`;

    const results = await this.query(query);

    return results
      .map((row) => {
        const parsedItemId = toNumberValue(row['item_id']);
        const itemName = toStringValue(row['item_name']);

        if (!parsedItemId || !itemName) {
          return null;
        }

        const item: Item = {
          itemId: parsedItemId,
          itemName,
        };

        const image = toStringValue(row['image']);
        if (image) {
          item.image = image;
        }
        const isMembersOnly = toBooleanValue(row['is_members_only']);
        if (isMembersOnly !== undefined) {
          item.isMembersOnly = isMembersOnly;
        }
        const examine = toStringValue(row['examine']);
        if (examine) {
          item.examine = examine;
        }
        const highAlchemyValue = toNumberValue(row['high_alchemy_value']);
        if (highAlchemyValue !== undefined) {
          item.highAlchemyValue = highAlchemyValue;
        }
        const value = toNumberValue(row['value']);
        if (value !== undefined) {
          item.value = value;
        }
        const weight = toNumberValue(row['weight']);
        if (weight !== undefined) {
          item.weight = weight;
        }
        const buyLimit = toNumberValue(row['buy_limit']);
        if (buyLimit !== undefined) {
          item.buyLimit = buyLimit;
        }
        const tradeable = toBooleanValue(row['tradeable']);
        if (tradeable !== undefined) {
          item.tradeable = tradeable;
        }

        return item;
      })
      .filter((item): item is Item => item !== null);
  }

  /**
   * Get all combat achievements
   */
  async getCombatAchievements(): Promise<CombatAchievement[]> {
    const query = `bucket('combat_achievement').select('id','name','monster','task','tier','type').run()`;

    const results = await this.query(query);

    return results
      .map((row) => {
        const id = toNumberValue(row['id']);
        const name = toStringValue(row['name']);
        const task = toStringValue(row['task']);
        const tier = toStringValue(row['tier']) as
          | CombatAchievement['tier']
          | undefined;

        if (!id || !name || !task || !tier) {
          return null;
        }

        const achievement: CombatAchievement = {
          id,
          name,
          task,
          tier,
        };

        const monster = toStringValue(row['monster']);
        if (monster) {
          achievement.monster = monster;
        }

        const type = toStringValue(row['type']);
        if (type) {
          achievement.type = type;
        }

        return achievement;
      })
      .filter(
        (achievement): achievement is CombatAchievement => achievement !== null
      );
  }
}

/**
 * Create a Wiki Bucket API client
 */
export function createWikiBucketClient(
  userAgent: string,
  options?: {
    retries?: number;
    timeoutMs?: number;
    cache?: CacheAdapter<BucketResult> | null;
    cacheTtlMs?: number;
  }
): WikiBucketClient {
  return new WikiBucketClient({ userAgent, ...options });
}
