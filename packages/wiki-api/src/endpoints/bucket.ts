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

/**
 * Monster data from bucket
 */
export interface Monster {
  name: string;
  version?: string | undefined;
  combatLevel?: number | undefined;
  hitpoints?: number | undefined;
  maxHit?: number | undefined;
  attackStyle?: string | undefined;
  attackSpeed?: number | undefined;
  aggressive?: boolean | undefined;
  poisonous?: boolean | undefined;
  immunePoison?: boolean | undefined;
  immuneVenom?: boolean | undefined;
  slayerLevel?: number | undefined;
  slayerXp?: number | undefined;
  slayerCategory?: string | undefined;
  assignedBy?: string | undefined;
  attackLevel?: number | undefined;
  strengthLevel?: number | undefined;
  defenceLevel?: number | undefined;
  magicLevel?: number | undefined;
  rangedLevel?: number | undefined;
  attackBonus?: number | undefined;
  strengthBonus?: number | undefined;
  magicAttackBonus?: number | undefined;
  magicStrengthBonus?: number | undefined;
  rangeAttackBonus?: number | undefined;
  rangeStrengthBonus?: number | undefined;
  stabDefence?: number | undefined;
  slashDefence?: number | undefined;
  crushDefence?: number | undefined;
  magicDefence?: number | undefined;
  rangeDefence?: number | undefined;
  examine?: string | undefined;
}

/**
 * Equipment bonuses data from bucket
 */
export interface EquipmentBonuses {
  itemId: number;
  itemName: string;
  slot?: string | undefined;
  stabAttack?: number | undefined;
  slashAttack?: number | undefined;
  crushAttack?: number | undefined;
  magicAttack?: number | undefined;
  rangeAttack?: number | undefined;
  stabDefence?: number | undefined;
  slashDefence?: number | undefined;
  crushDefence?: number | undefined;
  magicDefence?: number | undefined;
  rangeDefence?: number | undefined;
  strengthBonus?: number | undefined;
  rangeStrengthBonus?: number | undefined;
  magicDamageBonus?: number | undefined;
  prayerBonus?: number | undefined;
  attackSpeed?: number | undefined;
  attackRange?: number | undefined;
}

/**
 * Spell data from bucket
 */
export interface Spell {
  name: string;
  spellbook: string;
  levelRequired: number;
  type?: string | undefined;
  maxHit?: number | undefined;
  baseXp?: number | undefined;
  runes?: string | undefined;
  description?: string | undefined;
}

/**
 * Activity/minigame data from bucket
 */
export interface Activity {
  name: string;
  type?: string | undefined;
  participants?: string | undefined;
  skills?: string | undefined;
  rewards?: string | undefined;
  location?: string | undefined;
  requirements?: string | undefined;
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
      "bucket('quest').select('page_name','description','official_difficulty','official_length','requirements','start_point','items_required','enemies_to_defeat','ironman_concerns').limit(1000).run()";

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
    const query = `bucket('combat_achievement').select('id','name','monster','task','tier','type').limit(1000).run()`;

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

  /**
   * Get monster by name
   */
  async getMonster(name: string): Promise<Monster | null> {
    const query = `bucket('infobox_monster').select('name','version','combat','hitpoints','max_hit','attack_style','attack_speed','aggressive','poisonous','immune_poison','immune_venom','slaylvl','slayxp','cat','assigned_by','att','str','def','mage','range','attbns','strbns','apts','apls','apcs','apms','aprs','dstab','dslash','dcrush','dmage','drange','examine').where('name','${name}').limit(10).run()`;

    const results = await this.query(query);

    if (results.length === 0) {
      return null;
    }

    const row = results[0];
    if (!row) {
      return null;
    }

    const monsterName = toStringValue(row['name']);
    if (!monsterName) {
      return null;
    }

    const monster: Monster = { name: monsterName };

    const version = toStringValue(row['version']);
    if (version) monster.version = version;

    const combatLevel = toNumberValue(row['combat']);
    if (combatLevel !== undefined) monster.combatLevel = combatLevel;

    const hitpoints = toNumberValue(row['hitpoints']);
    if (hitpoints !== undefined) monster.hitpoints = hitpoints;

    const maxHit = toNumberValue(row['max_hit']);
    if (maxHit !== undefined) monster.maxHit = maxHit;

    const attackStyle = toStringValue(row['attack_style']);
    if (attackStyle) monster.attackStyle = attackStyle;

    const attackSpeed = toNumberValue(row['attack_speed']);
    if (attackSpeed !== undefined) monster.attackSpeed = attackSpeed;

    const aggressive = toBooleanValue(row['aggressive']);
    if (aggressive !== undefined) monster.aggressive = aggressive;

    const poisonous = toBooleanValue(row['poisonous']);
    if (poisonous !== undefined) monster.poisonous = poisonous;

    const immunePoison = toBooleanValue(row['immune_poison']);
    if (immunePoison !== undefined) monster.immunePoison = immunePoison;

    const immuneVenom = toBooleanValue(row['immune_venom']);
    if (immuneVenom !== undefined) monster.immuneVenom = immuneVenom;

    const slayerLevel = toNumberValue(row['slaylvl']);
    if (slayerLevel !== undefined) monster.slayerLevel = slayerLevel;

    const slayerXp = toNumberValue(row['slayxp']);
    if (slayerXp !== undefined) monster.slayerXp = slayerXp;

    const slayerCategory = toStringValue(row['cat']);
    if (slayerCategory) monster.slayerCategory = slayerCategory;

    const assignedBy = toStringValue(row['assigned_by']);
    if (assignedBy) monster.assignedBy = assignedBy;

    const attackLevel = toNumberValue(row['att']);
    if (attackLevel !== undefined) monster.attackLevel = attackLevel;

    const strengthLevel = toNumberValue(row['str']);
    if (strengthLevel !== undefined) monster.strengthLevel = strengthLevel;

    const defenceLevel = toNumberValue(row['def']);
    if (defenceLevel !== undefined) monster.defenceLevel = defenceLevel;

    const magicLevel = toNumberValue(row['mage']);
    if (magicLevel !== undefined) monster.magicLevel = magicLevel;

    const rangedLevel = toNumberValue(row['range']);
    if (rangedLevel !== undefined) monster.rangedLevel = rangedLevel;

    const attackBonus = toNumberValue(row['attbns']);
    if (attackBonus !== undefined) monster.attackBonus = attackBonus;

    const strengthBonus = toNumberValue(row['strbns']);
    if (strengthBonus !== undefined) monster.strengthBonus = strengthBonus;

    const stabDefence = toNumberValue(row['dstab']);
    if (stabDefence !== undefined) monster.stabDefence = stabDefence;

    const slashDefence = toNumberValue(row['dslash']);
    if (slashDefence !== undefined) monster.slashDefence = slashDefence;

    const crushDefence = toNumberValue(row['dcrush']);
    if (crushDefence !== undefined) monster.crushDefence = crushDefence;

    const magicDefence = toNumberValue(row['dmage']);
    if (magicDefence !== undefined) monster.magicDefence = magicDefence;

    const rangeDefence = toNumberValue(row['drange']);
    if (rangeDefence !== undefined) monster.rangeDefence = rangeDefence;

    const examine = toStringValue(row['examine']);
    if (examine) monster.examine = examine;

    return monster;
  }

  /**
   * Search monsters by name
   */
  async searchMonsters(name: string, limit = 20): Promise<Monster[]> {
    const query = `bucket('infobox_monster').select('name','version','combat','hitpoints','slaylvl','cat','examine').where('name','${name}').limit(${limit}).run()`;

    const results = await this.query(query);

    return results
      .map((row) => {
        const monsterName = toStringValue(row['name']);
        if (!monsterName) return null;

        const monster: Monster = { name: monsterName };

        const version = toStringValue(row['version']);
        if (version) monster.version = version;

        const combatLevel = toNumberValue(row['combat']);
        if (combatLevel !== undefined) monster.combatLevel = combatLevel;

        const hitpoints = toNumberValue(row['hitpoints']);
        if (hitpoints !== undefined) monster.hitpoints = hitpoints;

        const slayerLevel = toNumberValue(row['slaylvl']);
        if (slayerLevel !== undefined) monster.slayerLevel = slayerLevel;

        const slayerCategory = toStringValue(row['cat']);
        if (slayerCategory) monster.slayerCategory = slayerCategory;

        const examine = toStringValue(row['examine']);
        if (examine) monster.examine = examine;

        return monster;
      })
      .filter((m): m is Monster => m !== null);
  }

  /**
   * Get equipment bonuses by item name
   */
  async getEquipmentBonuses(
    itemName: string
  ): Promise<EquipmentBonuses | null> {
    const query = `bucket('infobox_bonuses').select('item_id','item_name','slot','astab','aslash','acrush','amagic','arange','dstab','dslash','dcrush','dmagic','drange','str','rstr','mdmg','prayer','aspeed','arange').where('item_name','${itemName}').limit(1).run()`;

    const results = await this.query(query);

    if (results.length === 0) {
      return null;
    }

    const row = results[0];
    if (!row) return null;

    const itemId = toNumberValue(row['item_id']);
    const name = toStringValue(row['item_name']);
    if (!itemId || !name) return null;

    const bonuses: EquipmentBonuses = {
      itemId,
      itemName: name,
    };

    const slot = toStringValue(row['slot']);
    if (slot) bonuses.slot = slot;

    const stabAttack = toNumberValue(row['astab']);
    if (stabAttack !== undefined) bonuses.stabAttack = stabAttack;

    const slashAttack = toNumberValue(row['aslash']);
    if (slashAttack !== undefined) bonuses.slashAttack = slashAttack;

    const crushAttack = toNumberValue(row['acrush']);
    if (crushAttack !== undefined) bonuses.crushAttack = crushAttack;

    const magicAttack = toNumberValue(row['amagic']);
    if (magicAttack !== undefined) bonuses.magicAttack = magicAttack;

    const rangeAttack = toNumberValue(row['arange']);
    if (rangeAttack !== undefined) bonuses.rangeAttack = rangeAttack;

    const stabDefence = toNumberValue(row['dstab']);
    if (stabDefence !== undefined) bonuses.stabDefence = stabDefence;

    const slashDefence = toNumberValue(row['dslash']);
    if (slashDefence !== undefined) bonuses.slashDefence = slashDefence;

    const crushDefence = toNumberValue(row['dcrush']);
    if (crushDefence !== undefined) bonuses.crushDefence = crushDefence;

    const magicDefence = toNumberValue(row['dmagic']);
    if (magicDefence !== undefined) bonuses.magicDefence = magicDefence;

    const rangeDefence = toNumberValue(row['drange']);
    if (rangeDefence !== undefined) bonuses.rangeDefence = rangeDefence;

    const strengthBonus = toNumberValue(row['str']);
    if (strengthBonus !== undefined) bonuses.strengthBonus = strengthBonus;

    const rangeStrengthBonus = toNumberValue(row['rstr']);
    if (rangeStrengthBonus !== undefined)
      bonuses.rangeStrengthBonus = rangeStrengthBonus;

    const magicDamageBonus = toNumberValue(row['mdmg']);
    if (magicDamageBonus !== undefined)
      bonuses.magicDamageBonus = magicDamageBonus;

    const prayerBonus = toNumberValue(row['prayer']);
    if (prayerBonus !== undefined) bonuses.prayerBonus = prayerBonus;

    const attackSpeed = toNumberValue(row['aspeed']);
    if (attackSpeed !== undefined) bonuses.attackSpeed = attackSpeed;

    return bonuses;
  }

  /**
   * Get spells by spellbook
   */
  async getSpells(spellbook?: string): Promise<Spell[]> {
    let query = `bucket('infobox_spell').select('name','spellbook','level','type','max_hit','base_xp','runes','description').limit(500).run()`;

    if (spellbook) {
      query = `bucket('infobox_spell').select('name','spellbook','level','type','max_hit','base_xp','runes','description').where('spellbook','${spellbook}').limit(500).run()`;
    }

    const results = await this.query(query);

    return results
      .map((row) => {
        const name = toStringValue(row['name']);
        const book = toStringValue(row['spellbook']);
        const level = toNumberValue(row['level']);

        if (!name || !book || level === undefined) return null;

        const spell: Spell = {
          name,
          spellbook: book,
          levelRequired: level,
        };

        const type = toStringValue(row['type']);
        if (type) spell.type = type;

        const maxHit = toNumberValue(row['max_hit']);
        if (maxHit !== undefined) spell.maxHit = maxHit;

        const baseXp = toNumberValue(row['base_xp']);
        if (baseXp !== undefined) spell.baseXp = baseXp;

        const runes = toStringValue(row['runes']);
        if (runes) spell.runes = runes;

        const description = toStringValue(row['description']);
        if (description) spell.description = description;

        return spell;
      })
      .filter((s): s is Spell => s !== null);
  }

  /**
   * Get activities/minigames
   */
  async getActivities(): Promise<Activity[]> {
    const query = `bucket('infobox_activity').select('name','type','participants','skills','rewards','location','requirements').limit(500).run()`;

    const results = await this.query(query);

    return results
      .map((row) => {
        const name = toStringValue(row['name']);
        if (!name) return null;

        const activity: Activity = { name };

        const type = toStringValue(row['type']);
        if (type) activity.type = type;

        const participants = toStringValue(row['participants']);
        if (participants) activity.participants = participants;

        const skills = toStringValue(row['skills']);
        if (skills) activity.skills = skills;

        const rewards = toStringValue(row['rewards']);
        if (rewards) activity.rewards = rewards;

        const location = toStringValue(row['location']);
        if (location) activity.location = location;

        const requirements = toStringValue(row['requirements']);
        if (requirements) activity.requirements = requirements;

        return activity;
      })
      .filter((a): a is Activity => a !== null);
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
