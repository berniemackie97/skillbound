/**
 * Milestone/goal templates organized by difficulty
 * Based on common ironman progression goals
 */

export interface MilestoneTemplate {
  name: string;
  description?: string;
  requirements?: Array<{
    type: 'skill' | 'quest' | 'item' | 'killcount' | 'custom';
    name: string;
    value: number | boolean;
  }>;
}

export const EASY_MILESTONES: MilestoneTemplate[] = [
  {
    name: 'Graceful outfit',
    description: '260 Marks of grace',
    requirements: [{ type: 'custom', name: 'Marks of grace', value: 260 }],
  },
  {
    name: 'Fairy rings',
    description: 'Unlock fairy ring network',
    requirements: [{ type: 'quest', name: 'Fairy Tale II', value: true }],
  },
  {
    name: 'Magic secateurs',
    description: 'Farming boost tool',
    requirements: [{ type: 'quest', name: 'Fairytale I', value: true }],
  },
  {
    name: 'Ardougne cloak 1',
    description: 'Easy Ardougne diary reward',
    requirements: [
      { type: 'custom', name: 'Ardougne Easy Diary', value: true },
    ],
  },
  {
    name: 'Bird house trapping',
    description: 'Passive hunter XP',
    requirements: [{ type: 'skill', name: 'Hunter', value: 5 }],
  },
  {
    name: 'Climbing boots',
    description: 'Early melee boots',
    requirements: [{ type: 'quest', name: 'Death Plateau', value: true }],
  },
  {
    name: "Ava's attractor",
    description: 'Ranged ammo retrieval',
    requirements: [{ type: 'quest', name: 'Animal Magnetism', value: true }],
  },
  {
    name: 'Protection prayers',
    description: '43 Prayer',
    requirements: [{ type: 'skill', name: 'Prayer', value: 43 }],
  },
  {
    name: 'Quests/Free-to-play',
    description: 'Finish all f2p quests',
    requirements: [{ type: 'custom', name: 'F2P Quests', value: true }],
  },
  {
    name: 'High Level Alchemy',
    description: '55 Magic',
    requirements: [{ type: 'skill', name: 'Magic', value: 55 }],
  },
];

export const MEDIUM_MILESTONES: MilestoneTemplate[] = [
  {
    name: 'Dragon Scimitar',
    description: 'Best early melee weapon',
    requirements: [{ type: 'quest', name: 'Monkey Madness I', value: true }],
  },
  {
    name: 'Dragon Battleaxe',
    description: 'Spec weapon',
    requirements: [{ type: 'quest', name: "Heroes' Quest", value: true }],
  },
  {
    name: 'Prayer Potions',
    description: '38 Herblore',
    requirements: [{ type: 'skill', name: 'Herblore', value: 38 }],
  },
  {
    name: 'Fighter Torso',
    description: 'Barbarian Assault reward',
    requirements: [{ type: 'custom', name: 'Barbarian Assault', value: true }],
  },
  {
    name: 'Black Mask',
    description: 'Slayer helm component',
    requirements: [{ type: 'item', name: 'Black mask', value: true }],
  },
  {
    name: 'Dragon Defender',
    description: 'Best in slot shield',
    requirements: [
      { type: 'skill', name: 'Attack', value: 60 },
      { type: 'skill', name: 'Defence', value: 60 },
      { type: 'custom', name: "Warriors' Guild tokens", value: 260 },
    ],
  },
  {
    name: 'Helm of Neitiznot',
    description: 'BiS melee helm',
    requirements: [{ type: 'quest', name: 'The Fremennik Isles', value: true }],
  },
  {
    name: 'Void Knight equipment',
    description: 'Pest Control reward',
    requirements: [{ type: 'custom', name: 'Pest Control points', value: 850 }],
  },
  {
    name: 'Barrows Gloves',
    description: 'BiS gloves',
    requirements: [{ type: 'quest', name: 'Recipe for Disaster', value: true }],
  },
  {
    name: 'Ancient Magicks',
    description: 'Unlock the spellbook',
    requirements: [{ type: 'quest', name: 'Desert Treasure', value: true }],
  },
  {
    name: 'Herb Sack',
    description: 'Tithe Farm reward',
    requirements: [{ type: 'custom', name: 'Tithe Farm points', value: 750 }],
  },
];

export const HARD_MILESTONES: MilestoneTemplate[] = [
  {
    name: 'Fire Cape',
    description: 'Complete TzHaar Fight Cave',
    requirements: [{ type: 'killcount', name: 'TzTok-Jad', value: 1 }],
  },
  {
    name: 'Dragon Boots',
    description: 'Spiritual mages drop',
    requirements: [{ type: 'item', name: 'Dragon boots', value: true }],
  },
  {
    name: 'Abyssal Whip',
    description: '85 Slayer unlock',
    requirements: [{ type: 'skill', name: 'Slayer', value: 85 }],
  },
  {
    name: 'Imbued God Cape',
    description: 'Mage Arena II',
    requirements: [{ type: 'custom', name: 'Mage Arena II', value: true }],
  },
  {
    name: 'Teleport to house (tablet)',
    description: 'Create lots of them',
    requirements: [{ type: 'skill', name: 'Construction', value: 40 }],
  },
  {
    name: 'Lunar Spellbook',
    description: 'Unlock Lunar spells',
    requirements: [{ type: 'quest', name: 'Lunar Diplomacy', value: true }],
  },
  {
    name: 'Rune pouch',
    description: 'LMS or Slayer points',
    requirements: [{ type: 'custom', name: 'Slayer points', value: 1250 }],
  },
  {
    name: 'Blessed dragonhide armour',
    description: 'Clue scroll reward',
    requirements: [{ type: 'custom', name: 'Hard clue scrolls', value: 10 }],
  },
  {
    name: 'Super potion set',
    description: 'Get lots of them',
    requirements: [{ type: 'skill', name: 'Herblore', value: 81 }],
  },
  {
    name: 'Crystal Shield',
    description: 'Song of the Elves',
    requirements: [{ type: 'quest', name: 'Song of the Elves', value: true }],
  },
  {
    name: 'Infinity Boots',
    description: 'Mage Training Arena',
    requirements: [{ type: 'custom', name: 'MTA points', value: true }],
  },
  {
    name: 'Hard Diary',
    description: 'Finish them all',
    requirements: [{ type: 'custom', name: 'Hard Diaries', value: 12 }],
  },
  {
    name: 'Barrows',
    description: 'Relevant gearsets',
    requirements: [{ type: 'killcount', name: 'Barrows Chests', value: 100 }],
  },
];

export const ELITE_MILESTONES: MilestoneTemplate[] = [
  {
    name: 'Trident of the swamp',
    description: 'Upgraded trident',
    requirements: [
      { type: 'item', name: 'Trident of the seas', value: true },
      { type: 'item', name: 'Toxic blowpipe', value: true },
    ],
  },
  {
    name: 'Toxic blowpipe',
    description: 'BiS ranged weapon',
    requirements: [{ type: 'killcount', name: 'Zulrah', value: 1 }],
  },
  {
    name: 'Dragon hunter lance',
    description: 'Alchemical Hydra drop',
    requirements: [{ type: 'killcount', name: 'Alchemical Hydra', value: 1 }],
  },
  {
    name: 'Zenyte jewelry',
    description: 'All 4 zenyte pieces',
    requirements: [{ type: 'item', name: 'Zenyte shard', value: 4 }],
  },
  {
    name: 'Bandos armor',
    description: 'Chestplate + tassets',
    requirements: [{ type: 'killcount', name: 'General Graardor', value: 100 }],
  },
  {
    name: 'Armadyl armor',
    description: 'Chestplate + chainskirt',
    requirements: [{ type: 'killcount', name: "Kree'arra", value: 100 }],
  },
  {
    name: 'Ancestral robes',
    description: 'Full set from CoX',
    requirements: [
      { type: 'killcount', name: 'Chambers of Xeric', value: 100 },
    ],
  },
  {
    name: 'Dragon Warhammer',
    description: 'Lizardman shamans',
    requirements: [{ type: 'item', name: 'Dragon warhammer', value: true }],
  },
  {
    name: 'Infernal Cape',
    description: 'Complete the Inferno',
    requirements: [{ type: 'killcount', name: 'TzKal-Zuk', value: 1 }],
  },
  {
    name: 'Elite Diaries',
    description: 'All elite diaries',
    requirements: [{ type: 'custom', name: 'Elite Diaries', value: 12 }],
  },
];

export const MASTER_MILESTONES: MilestoneTemplate[] = [
  {
    name: 'Twisted bow',
    description: 'BiS ranged weapon',
    requirements: [
      { type: 'killcount', name: 'Chambers of Xeric', value: 500 },
    ],
  },
  {
    name: 'Scythe of vitur',
    description: 'BiS melee weapon',
    requirements: [{ type: 'killcount', name: 'Theatre of Blood', value: 500 }],
  },
  {
    name: "Tumeken's shadow",
    description: 'BiS magic weapon',
    requirements: [{ type: 'killcount', name: 'Tombs of Amascut', value: 500 }],
  },
  {
    name: 'Nightmare staff',
    description: 'Harmonised/Volatile/Inquisitor',
    requirements: [{ type: 'killcount', name: 'Nightmare', value: 100 }],
  },
  {
    name: 'Torva armor',
    description: 'Full Torva set',
    requirements: [{ type: 'killcount', name: 'Nex', value: 100 }],
  },
  {
    name: 'Masori armor',
    description: 'Full Masori set',
    requirements: [{ type: 'killcount', name: 'Tombs of Amascut', value: 200 }],
  },
  {
    name: 'Virtus armor',
    description: 'Full Virtus set',
    requirements: [{ type: 'killcount', name: 'Duke Sucellus', value: 100 }],
  },
  {
    name: 'Max Cape',
    description: 'All 99s',
    requirements: [{ type: 'custom', name: 'Total level', value: 2277 }],
  },
  {
    name: 'Quest Cape',
    description: 'All quests completed',
    requirements: [{ type: 'custom', name: 'Quest points', value: 300 }],
  },
  {
    name: 'Collection log 1000+ items',
    description: 'Major collection milestone',
    requirements: [{ type: 'custom', name: 'Collection log', value: 1000 }],
  },
];

export const ALL_MILESTONES = {
  easy: EASY_MILESTONES,
  medium: MEDIUM_MILESTONES,
  hard: HARD_MILESTONES,
  elite: ELITE_MILESTONES,
  master: MASTER_MILESTONES,
};
