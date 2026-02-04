import type { ProgressionItemTemplate } from '../schema/progression/progression';

/**
 * Ironman Progression Templates
 * Based on common ironman progression spreadsheets
 * These represent major milestones that aren't auto-tracked by quests/achievements
 */

export const ESSENTIAL_GEAR_ITEMS: ProgressionItemTemplate[] = [
  {
    name: 'Barrows Gloves',
    description: 'Recipe for Disaster reward - BiS gloves',
    itemType: 'gear',
    itemId: 7462,
    orderIndex: 1,
  },
  {
    name: 'Fire Cape',
    description: 'TzHaar Fight Cave reward',
    itemType: 'gear',
    itemId: 6570,
    orderIndex: 2,
  },
  {
    name: 'Dragon Defender',
    description: 'Warriors Guild drop',
    itemType: 'gear',
    itemId: 12954,
    orderIndex: 3,
  },
  {
    name: 'Amulet of Fury',
    description: 'Crafted or Zenyte upgrade',
    itemType: 'gear',
    itemId: 6585,
    orderIndex: 4,
  },
  {
    name: 'Berserker Ring (i)',
    description: 'DKs drop, imbued at NMZ',
    itemType: 'gear',
    itemId: 11773,
    orderIndex: 5,
  },
  {
    name: 'Black Mask (i)',
    description: 'Cave horror drop, imbued',
    itemType: 'gear',
    itemId: 11774,
    orderIndex: 6,
  },
  {
    name: 'Trident of the Seas',
    description: 'Cave kraken drop',
    itemType: 'gear',
    itemId: 11905,
    orderIndex: 7,
  },
  {
    name: 'Blowpipe',
    description: 'Zulrah drop',
    itemType: 'gear',
    itemId: 12926,
    orderIndex: 8,
  },
  {
    name: 'Zenyte Jewelry Set',
    description: 'All 4 zenyte jewelry pieces',
    itemType: 'goal',
    orderIndex: 9,
  },
  {
    name: 'Full Graceful',
    description: 'Rooftop agility outfit',
    itemType: 'gear',
    itemId: 11850, // Graceful hood
    orderIndex: 10,
  },
];

export const MAJOR_UNLOCKS_ITEMS: ProgressionItemTemplate[] = [
  {
    name: 'Piety',
    description: '70 Prayer unlock from Knight Waves',
    itemType: 'unlock',
    unlockFlag: 'prayer_piety',
    orderIndex: 1,
  },
  {
    name: 'Rigour',
    description: '74 Prayer unlock from raids',
    itemType: 'unlock',
    unlockFlag: 'prayer_rigour',
    orderIndex: 2,
  },
  {
    name: 'Augury',
    description: '77 Prayer unlock from raids',
    itemType: 'unlock',
    unlockFlag: 'prayer_augury',
    orderIndex: 3,
  },
  {
    name: 'Vengeance',
    description: 'Lunar spellbook unlock',
    itemType: 'unlock',
    unlockFlag: 'spell_vengeance',
    orderIndex: 4,
  },
  {
    name: 'Fairy Rings',
    description: 'Fairy Tale II partial completion',
    itemType: 'unlock',
    unlockFlag: 'fairy_rings',
    orderIndex: 5,
  },
  {
    name: 'Ancient Magicks',
    description: 'Desert Treasure reward',
    itemType: 'unlock',
    unlockFlag: 'ancient_magicks',
    orderIndex: 6,
  },
  {
    name: 'Lunar Spellbook',
    description: 'Lunar Diplomacy reward',
    itemType: 'unlock',
    unlockFlag: 'lunar_spellbook',
    orderIndex: 7,
  },
  {
    name: 'Arceuus Spellbook',
    description: '60% Arceuus favor',
    itemType: 'unlock',
    unlockFlag: 'arceuus_spellbook',
    orderIndex: 8,
  },
  {
    name: 'Protect from Melee',
    description: '43 Prayer',
    itemType: 'unlock',
    unlockFlag: 'prayer_protect_melee',
    orderIndex: 9,
  },
  {
    name: 'Dragon Slayer II Access',
    description: 'Unlocks adamant/rune dragons',
    itemType: 'unlock',
    unlockFlag: 'ds2_access',
    orderIndex: 10,
  },
];

export const TRANSPORTATION_ITEMS: ProgressionItemTemplate[] = [
  {
    name: 'Varrock Teleport',
    description: 'Standard spellbook 25 magic',
    itemType: 'unlock',
    unlockFlag: 'teleport_varrock',
    orderIndex: 1,
  },
  {
    name: 'Lumbridge Teleport',
    description: 'Standard spellbook 31 magic',
    itemType: 'unlock',
    unlockFlag: 'teleport_lumbridge',
    orderIndex: 2,
  },
  {
    name: 'Falador Teleport',
    description: 'Standard spellbook 37 magic',
    itemType: 'unlock',
    unlockFlag: 'teleport_falador',
    orderIndex: 3,
  },
  {
    name: 'Camelot Teleport',
    description: 'Standard spellbook 45 magic',
    itemType: 'unlock',
    unlockFlag: 'teleport_camelot',
    orderIndex: 4,
  },
  {
    name: 'Ardougne Cloak',
    description: 'Ardougne diary reward',
    itemType: 'gear',
    itemId: 13124,
    orderIndex: 5,
  },
  {
    name: 'Ectophial',
    description: 'Ghosts Ahoy reward',
    itemType: 'item',
    itemId: 4251,
    orderIndex: 6,
  },
  {
    name: 'Quest Cape',
    description: 'All quests completed',
    itemType: 'gear',
    itemId: 9813,
    orderIndex: 7,
  },
  {
    name: 'Construction Cape',
    description: '99 Construction - unlimited house teleports',
    itemType: 'gear',
    itemId: 9804,
    orderIndex: 8,
  },
];

export const SKILLING_UNLOCKS_ITEMS: ProgressionItemTemplate[] = [
  {
    name: 'Herb Sack',
    description: 'Tithe Farm reward',
    itemType: 'item',
    itemId: 13226,
    orderIndex: 1,
  },
  {
    name: 'Seed Box',
    description: 'Tithe Farm reward',
    itemType: 'item',
    itemId: 13639,
    orderIndex: 2,
  },
  {
    name: 'Rune Pouch',
    description: 'Slayer/LMS reward',
    itemType: 'item',
    itemId: 12791,
    orderIndex: 3,
  },
  {
    name: 'Coal Bag',
    description: 'Motherlode Mine reward',
    itemType: 'item',
    itemId: 12019,
    orderIndex: 4,
  },
  {
    name: 'Gem Bag',
    description: 'Motherlode Mine reward',
    itemType: 'item',
    itemId: 12020,
    orderIndex: 5,
  },
  {
    name: 'Crystal Saw',
    description: 'Eyes of Glouphrie reward',
    itemType: 'item',
    itemId: 11888,
    orderIndex: 6,
  },
  {
    name: 'Big Fishing Net',
    description: 'Drift net fishing unlock',
    itemType: 'unlock',
    unlockFlag: 'drift_net_fishing',
    orderIndex: 7,
  },
  {
    name: 'Bottomless Compost Bucket',
    description: 'Hespori drop',
    itemType: 'item',
    itemId: 22997,
    orderIndex: 8,
  },
];

export const BOSS_UNLOCKS_ITEMS: ProgressionItemTemplate[] = [
  {
    name: 'Kraken Boss',
    description: '87 Slayer unlock',
    itemType: 'unlock',
    unlockFlag: 'boss_kraken',
    orderIndex: 1,
  },
  {
    name: 'Cerberus',
    description: '91 Slayer unlock',
    itemType: 'unlock',
    unlockFlag: 'boss_cerberus',
    orderIndex: 2,
  },
  {
    name: 'Thermonuclear Smoke Devil',
    description: '93 Slayer unlock',
    itemType: 'unlock',
    unlockFlag: 'boss_thermy',
    orderIndex: 3,
  },
  {
    name: 'Abyssal Sire',
    description: '85 Slayer unlock',
    itemType: 'unlock',
    unlockFlag: 'boss_sire',
    orderIndex: 4,
  },
  {
    name: 'Zulrah',
    description: 'Regicide completion',
    itemType: 'unlock',
    unlockFlag: 'boss_zulrah',
    orderIndex: 5,
  },
  {
    name: 'Vorkath',
    description: 'Dragon Slayer II',
    itemType: 'unlock',
    unlockFlag: 'boss_vorkath',
    orderIndex: 6,
  },
  {
    name: 'Chambers of Xeric',
    description: 'Raids 1 access',
    itemType: 'unlock',
    unlockFlag: 'raid_cox',
    orderIndex: 7,
  },
  {
    name: 'Theatre of Blood',
    description: 'Raids 2 access',
    itemType: 'unlock',
    unlockFlag: 'raid_tob',
    orderIndex: 8,
  },
  {
    name: 'Tombs of Amascut',
    description: 'Raids 3 access',
    itemType: 'unlock',
    unlockFlag: 'raid_toa',
    orderIndex: 9,
  },
  {
    name: 'God Wars Dungeon',
    description: 'All GWD bosses accessible',
    itemType: 'unlock',
    unlockFlag: 'boss_gwd',
    orderIndex: 10,
  },
];

export const QUEST_MILESTONES_ITEMS: ProgressionItemTemplate[] = [
  {
    name: 'Recipe for Disaster',
    description: 'All RFD subquests complete',
    itemType: 'goal',
    orderIndex: 1,
  },
  {
    name: 'Dragon Slayer II',
    description: 'Elite quest completion',
    itemType: 'goal',
    orderIndex: 2,
  },
  {
    name: 'Song of the Elves',
    description: 'Elite quest completion',
    itemType: 'goal',
    orderIndex: 3,
  },
  {
    name: 'Quest Cape',
    description: 'All quests completed',
    itemType: 'goal',
    orderIndex: 4,
  },
  {
    name: 'Monkey Madness II',
    description: 'Elite quest completion',
    itemType: 'goal',
    orderIndex: 5,
  },
  {
    name: 'A Kingdom Divided',
    description: 'Master quest completion',
    itemType: 'goal',
    orderIndex: 6,
  },
];

export const DIARY_REWARDS_ITEMS: ProgressionItemTemplate[] = [
  {
    name: 'Ardougne Elite Diary',
    description: 'Unlimited teleports',
    itemType: 'goal',
    orderIndex: 1,
  },
  {
    name: 'Desert Elite Diary',
    description: 'No waterskins in desert',
    itemType: 'goal',
    orderIndex: 2,
  },
  {
    name: 'Karamja Elite Diary',
    description: 'Unlimited Duradel teleports',
    itemType: 'goal',
    orderIndex: 3,
  },
  {
    name: 'Morytania Elite Diary',
    description: '50% more barrows runes',
    itemType: 'goal',
    orderIndex: 4,
  },
  {
    name: 'Western Provinces Elite Diary',
    description: 'Unlimited Piscatoris teleports',
    itemType: 'goal',
    orderIndex: 5,
  },
  {
    name: 'Wilderness Elite Diary',
    description: 'Free teleports to fountain',
    itemType: 'goal',
    orderIndex: 6,
  },
];

export const ACHIEVEMENT_MILESTONES_ITEMS: ProgressionItemTemplate[] = [
  {
    name: 'Music Cape',
    description: 'All music tracks unlocked',
    itemType: 'goal',
    orderIndex: 1,
  },
  {
    name: 'Combat Achievement - Easy',
    description: 'All easy CA tasks',
    itemType: 'goal',
    orderIndex: 2,
  },
  {
    name: 'Combat Achievement - Medium',
    description: 'All medium CA tasks',
    itemType: 'goal',
    orderIndex: 3,
  },
  {
    name: 'Combat Achievement - Hard',
    description: 'All hard CA tasks',
    itemType: 'goal',
    orderIndex: 4,
  },
  {
    name: 'Combat Achievement - Elite',
    description: 'All elite CA tasks',
    itemType: 'goal',
    orderIndex: 5,
  },
  {
    name: 'Combat Achievement - Master',
    description: 'All master CA tasks',
    itemType: 'goal',
    orderIndex: 6,
  },
  {
    name: 'Combat Achievement - Grandmaster',
    description: 'All grandmaster CA tasks',
    itemType: 'goal',
    orderIndex: 7,
  },
];

/**
 * All progression categories with their items
 */
export const PROGRESSION_CATEGORIES = [
  {
    name: 'Essential Gear',
    description: 'Critical gear upgrades for ironman progression',
    icon: '⚔️',
    orderIndex: 1,
    defaultItems: ESSENTIAL_GEAR_ITEMS,
  },
  {
    name: 'Major Unlocks',
    description: 'Important prayers, spells, and game mechanics',
    icon: '🔓',
    orderIndex: 2,
    defaultItems: MAJOR_UNLOCKS_ITEMS,
  },
  {
    name: 'Transportation',
    description: 'Teleports and movement unlocks',
    icon: '🗺️',
    orderIndex: 3,
    defaultItems: TRANSPORTATION_ITEMS,
  },
  {
    name: 'Skilling Unlocks',
    description: 'Quality of life items for skilling',
    icon: '🛠️',
    orderIndex: 4,
    defaultItems: SKILLING_UNLOCKS_ITEMS,
  },
  {
    name: 'Boss Unlocks',
    description: 'Access to major PvM content',
    icon: '👹',
    orderIndex: 5,
    defaultItems: BOSS_UNLOCKS_ITEMS,
  },
  {
    name: 'Quest Milestones',
    description: 'Major quest completions',
    icon: '📜',
    orderIndex: 6,
    defaultItems: QUEST_MILESTONES_ITEMS,
  },
  {
    name: 'Diary Rewards',
    description: 'Elite diary completion rewards',
    icon: '📔',
    orderIndex: 7,
    defaultItems: DIARY_REWARDS_ITEMS,
  },
  {
    name: 'Achievement Milestones',
    description: 'Collection log and combat achievements',
    icon: '🏆',
    orderIndex: 8,
    defaultItems: ACHIEVEMENT_MILESTONES_ITEMS,
  },
] as const;
