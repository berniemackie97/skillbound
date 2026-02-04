/**
 * Gear progression templates organized by game stage
 * Based on ironman progression spreadsheets
 */

export interface GearTemplate {
  slot: string;
  itemName: string;
  itemId?: number;
  source: string;
  priority: number; // 1-5, higher = more important
  style?: string; // melee, ranged, magic, all
}

export const EARLY_GAME_GEAR: GearTemplate[] = [
  // Melee
  { slot: 'head', itemName: 'Helm of neitiznot', itemId: 10828, source: 'The Fremennik Isles', priority: 5, style: 'melee' },
  { slot: 'body', itemName: 'Fighter torso', itemId: 10551, source: 'Barbarian Assault', priority: 5, style: 'melee' },
  { slot: 'legs', itemName: 'Obsidian platelegs', itemId: 6528, source: 'TzHaar shops', priority: 3, style: 'melee' },
  { slot: 'cape', itemName: 'Obsidian cape', itemId: 6568, source: 'TzHaar Fight Pit', priority: 2, style: 'melee' },
  { slot: 'weapon', itemName: 'Dragon scimitar', itemId: 4587, source: 'Monkey Madness I', priority: 5, style: 'melee' },
  { slot: 'shield', itemName: 'Dragon defender', itemId: 12954, source: "Warriors' Guild", priority: 5, style: 'melee' },
  { slot: 'boots', itemName: 'Climbing boots', itemId: 3105, source: 'Death Plateau', priority: 3, style: 'all' },

  // Ranged
  { slot: 'body', itemName: 'Black d\'hide body', itemId: 2503, source: '70 Ranged + crafting', priority: 4, style: 'ranged' },
  { slot: 'legs', itemName: 'Black d\'hide chaps', itemId: 2497, source: '70 Ranged + crafting', priority: 4, style: 'ranged' },
  { slot: 'weapon', itemName: 'Rune crossbow', itemId: 9185, source: 'Temple of Ikov', priority: 4, style: 'ranged' },
  { slot: 'ammo', itemName: 'Broad bolts', itemId: 13280, source: '55 Slayer', priority: 4, style: 'ranged' },

  // Magic
  { slot: 'weapon', itemName: 'Iban\'s staff', itemId: 1409, source: 'Underground Pass', priority: 5, style: 'magic' },
  { slot: 'body', itemName: 'Mystic robe top', itemId: 4101, source: 'Shops/drops', priority: 3, style: 'magic' },
  { slot: 'legs', itemName: 'Mystic robe bottom', itemId: 4103, source: 'Shops/drops', priority: 3, style: 'magic' },
];

export const MID_GAME_GEAR: GearTemplate[] = [
  // Melee
  { slot: 'cape', itemName: 'Fire cape', itemId: 6570, source: 'TzHaar Fight Cave', priority: 5, style: 'melee' },
  { slot: 'weapon', itemName: 'Abyssal whip', itemId: 4151, source: 'Abyssal demons (85 Slayer)', priority: 5, style: 'melee' },
  { slot: 'boots', itemName: 'Dragon boots', itemId: 11840, source: 'Spiritual mages', priority: 4, style: 'melee' },
  { slot: 'legs', itemName: 'Dharok\'s platelegs', itemId: 4722, source: 'Barrows', priority: 4, style: 'melee' },
  { slot: 'body', itemName: 'Blood moon armor', source: 'Vyrewatch Sentinels', priority: 3, style: 'melee' },

  // Ranged
  { slot: 'weapon', itemName: 'Toxic blowpipe', itemId: 12926, source: 'Zulrah', priority: 5, style: 'ranged' },
  { slot: 'head', itemName: 'Archer helm', itemId: 11826, source: 'Nightmare Zone', priority: 4, style: 'ranged' },

  // Magic
  { slot: 'weapon', itemName: 'Trident of the seas', itemId: 11905, source: 'Cave kraken (87 Slayer)', priority: 5, style: 'magic' },
  { slot: 'staff', itemName: 'Ancient staff', itemId: 4675, source: 'Desert Treasure', priority: 4, style: 'magic' },
  { slot: 'body', itemName: 'Ahrim the Blighted\'s robetop', itemId: 4712, source: 'Barrows', priority: 4, style: 'magic' },
  { slot: 'legs', itemName: 'Ahrim the Blighted\'s robeskirt', itemId: 4714, source: 'Barrows', priority: 4, style: 'magic' },

  // Misc
  { slot: 'hands', itemName: 'Barrows gloves', itemId: 7462, source: 'Recipe for Disaster', priority: 5, style: 'all' },
  { slot: 'ring', itemName: 'Berserker ring (i)', itemId: 11773, source: 'Dagannoth Kings + NMZ', priority: 4, style: 'melee' },
];

export const LATE_GAME_GEAR: GearTemplate[] = [
  // Melee
  { slot: 'head', itemName: 'Neitiznot faceguard', itemId: 23351, source: 'Basilisk Knights', priority: 5, style: 'melee' },
  { slot: 'body', itemName: 'Bandos chestplate', itemId: 11832, source: 'General Graardor', priority: 5, style: 'melee' },
  { slot: 'legs', itemName: 'Bandos tassets', itemId: 11834, source: 'General Graardor', priority: 5, style: 'melee' },
  { slot: 'weapon', itemName: 'Ghrazi rapier', itemId: 22324, source: 'Theatre of Blood', priority: 5, style: 'melee' },
  { slot: 'weapon', itemName: 'Inquisitor\'s mace', itemId: 24417, source: 'Nightmare', priority: 4, style: 'melee' },

  // Ranged
  { slot: 'body', itemName: 'Armadyl chestplate', itemId: 11828, source: 'Kree\'arra', priority: 5, style: 'ranged' },
  { slot: 'legs', itemName: 'Armadyl chainskirt', itemId: 11830, source: 'Kree\'arra', priority: 5, style: 'ranged' },
  { slot: 'weapon', itemName: 'Twisted bow', itemId: 20997, source: 'Chambers of Xeric', priority: 5, style: 'ranged' },
  { slot: 'weapon', itemName: 'Bow of faerdhinen (c)', itemId: 25865, source: 'Corrupted Gauntlet', priority: 5, style: 'ranged' },

  // Magic
  { slot: 'weapon', itemName: 'Harmonised nightmare staff', itemId: 24424, source: 'Nightmare', priority: 5, style: 'magic' },
  { slot: 'weapon', itemName: 'Kodai wand', itemId: 21006, source: 'Chambers of Xeric', priority: 5, style: 'magic' },
  { slot: 'head', itemName: 'Ancestral hat', itemId: 21018, source: 'Chambers of Xeric', priority: 4, style: 'magic' },
  { slot: 'body', itemName: 'Ancestral robe top', itemId: 21021, source: 'Chambers of Xeric', priority: 5, style: 'magic' },
  { slot: 'legs', itemName: 'Ancestral robe bottom', itemId: 21024, source: 'Chambers of Xeric', priority: 5, style: 'magic' },
];

export const END_GAME_GEAR: GearTemplate[] = [
  // BiS items
  { slot: 'cape', itemName: 'Infernal cape', itemId: 21295, source: 'Inferno', priority: 5, style: 'melee' },
  { slot: 'neck', itemName: 'Amulet of torture', itemId: 19553, source: 'Zenyte crafting', priority: 5, style: 'melee' },
  { slot: 'neck', itemName: 'Anguish', itemId: 19547, source: 'Zenyte crafting', priority: 5, style: 'ranged' },
  { slot: 'neck', itemName: 'Tormented bracelet', itemId: 19544, source: 'Zenyte crafting', priority: 5, style: 'magic' },
  { slot: 'ring', itemName: 'Ultor ring', itemId: 28307, source: 'Desert Treasure II', priority: 5, style: 'melee' },
  { slot: 'ring', itemName: 'Venator ring', itemId: 28313, source: 'Desert Treasure II', priority: 5, style: 'ranged' },
  { slot: 'ring', itemName: 'Magus ring', itemId: 28301, source: 'Desert Treasure II', priority: 5, style: 'magic' },
  { slot: 'weapon', itemName: 'Scythe of vitur', itemId: 22325, source: 'Theatre of Blood', priority: 5, style: 'melee' },
  { slot: 'weapon', itemName: 'Tumeken\'s shadow', itemId: 27277, source: 'Tombs of Amascut', priority: 5, style: 'magic' },
];

export const SPECIALIZED_GEAR: GearTemplate[] = [
  // Utility/specialized
  { slot: 'cape', itemName: 'Ava\'s assembler', itemId: 22109, source: 'Dragon Slayer II', priority: 5, style: 'ranged' },
  { slot: 'weapon', itemName: 'Dragon hunter lance', itemId: 22978, source: 'Alchemical Hydra', priority: 4, style: 'melee' },
  { slot: 'weapon', itemName: 'Dragon hunter crossbow', itemId: 21012, source: 'Chambers of Xeric', priority: 4, style: 'ranged' },
  { slot: 'shield', itemName: 'Dragonfire shield', itemId: 11284, source: 'Dragon drops + smithing', priority: 3, style: 'melee' },
  { slot: 'shield', itemName: 'Crystal shield', itemId: 23982, source: 'Corrupted Gauntlet', priority: 3, style: 'all' },
  { slot: 'body', itemName: 'Justiciar armor', source: 'Theatre of Blood', priority: 3, style: 'tank' },
  { slot: 'weapon', itemName: 'Sanguinesti staff', itemId: 22323, source: 'Theatre of Blood', priority: 4, style: 'magic' },
];

export const ALL_GEAR_STAGES = {
  early: EARLY_GAME_GEAR,
  mid: MID_GAME_GEAR,
  late: LATE_GAME_GEAR,
  end: END_GAME_GEAR,
  specialized: SPECIALIZED_GEAR,
};
