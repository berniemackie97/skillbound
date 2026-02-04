/**
 * Boss definitions for killcount tracking
 * Organized by boss type/location
 */

export interface BossTemplate {
  name: string;
  category: string;
  wiki_name?: string;
}

export const WORLD_BOSSES: BossTemplate[] = [
  { name: 'Abyssal Sire', category: 'Slayer', wiki_name: 'Abyssal Sire' },
  { name: 'Alchemical Hydra', category: 'Slayer', wiki_name: 'Alchemical Hydra' },
  { name: 'Artio', category: 'Wilderness', wiki_name: 'Artio' },
  { name: 'Barrows Chests', category: 'Minigame', wiki_name: 'Barrows' },
  { name: 'Bryophyta', category: 'F2P', wiki_name: 'Bryophyta' },
  { name: 'Callisto', category: 'Wilderness', wiki_name: 'Callisto' },
  { name: "Calvar'ion", category: 'Wilderness', wiki_name: "Calvar'ion" },
  { name: 'Cerberus', category: 'Slayer', wiki_name: 'Cerberus' },
  { name: 'Chaos Elemental', category: 'Wilderness', wiki_name: 'Chaos Elemental' },
  { name: 'Chaos Fanatic', category: 'Wilderness', wiki_name: 'Chaos Fanatic' },
  { name: 'Commander Zilyana', category: 'God Wars', wiki_name: 'Commander Zilyana' },
  { name: 'Corporeal Beast', category: 'Other', wiki_name: 'Corporeal Beast' },
  { name: 'Crazy Archaeologist', category: 'Wilderness', wiki_name: 'Crazy archaeologist' },
  { name: 'Dagannoth Prime', category: 'Other', wiki_name: 'Dagannoth Prime' },
  { name: 'Dagannoth Rex', category: 'Other', wiki_name: 'Dagannoth Rex' },
  { name: 'Dagannoth Supreme', category: 'Other', wiki_name: 'Dagannoth Supreme' },
  { name: 'Deranged Archaeologist', category: 'Wilderness', wiki_name: 'Deranged Archaeologist' },
  { name: 'Duke Sucellus', category: 'Desert Treasure II', wiki_name: 'Duke Sucellus' },
  { name: 'General Graardor', category: 'God Wars', wiki_name: 'General Graardor' },
  { name: 'Giant Mole', category: 'Other', wiki_name: 'Giant Mole' },
  { name: 'Grotesque Guardians', category: 'Slayer', wiki_name: 'Grotesque Guardians' },
  { name: 'Hespori', category: 'Farming', wiki_name: 'Hespori' },
  { name: 'Kalphite Queen', category: 'Other', wiki_name: 'Kalphite Queen' },
  { name: 'King Black Dragon', category: 'Other', wiki_name: 'King Black Dragon' },
  { name: 'Kraken', category: 'Slayer', wiki_name: 'Kraken' },
  { name: "Kree'arra", category: 'God Wars', wiki_name: "Kree'arra" },
  { name: "K'ril Tsutsaroth", category: 'God Wars', wiki_name: "K'ril Tsutsaroth" },
  { name: 'Mimic', category: 'Other', wiki_name: 'Mimic' },
  { name: 'Nex', category: 'God Wars', wiki_name: 'Nex' },
  { name: 'Nightmare', category: 'Other', wiki_name: 'Nightmare' },
  { name: "Phosani's Nightmare", category: 'Other', wiki_name: "Phosani's Nightmare" },
  { name: 'Obor', category: 'F2P', wiki_name: 'Obor' },
  { name: 'Phantom Muspah', category: 'Other', wiki_name: 'Phantom Muspah' },
  { name: 'Sarachnis', category: 'Other', wiki_name: 'Sarachnis' },
  { name: 'Scorpia', category: 'Wilderness', wiki_name: 'Scorpia' },
  { name: 'Scurrius', category: 'F2P', wiki_name: 'Scurrius' },
  { name: 'Skotizo', category: 'Other', wiki_name: 'Skotizo' },
  { name: 'Spindel', category: 'Wilderness', wiki_name: 'Spindel' },
  { name: 'Tempoross', category: 'Minigame', wiki_name: 'Tempoross' },
  { name: 'The Gauntlet', category: 'Other', wiki_name: 'The Gauntlet' },
  { name: 'The Corrupted Gauntlet', category: 'Other', wiki_name: 'The Corrupted Gauntlet' },
  { name: 'The Leviathan', category: 'Desert Treasure II', wiki_name: 'The Leviathan' },
  { name: 'The Whisperer', category: 'Desert Treasure II', wiki_name: 'The Whisperer' },
  { name: 'Thermonuclear Smoke Devil', category: 'Slayer', wiki_name: 'Thermonuclear smoke devil' },
  { name: 'TzKal-Zuk', category: 'Inferno', wiki_name: 'TzKal-Zuk' },
  { name: 'TzTok-Jad', category: 'Fight Caves', wiki_name: 'TzTok-Jad' },
  { name: 'Vardorvis', category: 'Desert Treasure II', wiki_name: 'Vardorvis' },
  { name: 'Venenatis', category: 'Wilderness', wiki_name: 'Venenatis' },
  { name: "Vet'ion", category: 'Wilderness', wiki_name: "Vet'ion" },
  { name: 'Vorkath', category: 'Other', wiki_name: 'Vorkath' },
  { name: 'Wintertodt', category: 'Minigame', wiki_name: 'Wintertodt' },
  { name: 'Zalcano', category: 'Other', wiki_name: 'Zalcano' },
  { name: 'Zulrah', category: 'Other', wiki_name: 'Zulrah' },
];

export const RAID_BOSSES: BossTemplate[] = [
  { name: 'Chambers of Xeric', category: 'Raids', wiki_name: 'Chambers of Xeric' },
  { name: 'Chambers of Xeric: Challenge Mode', category: 'Raids', wiki_name: 'Chambers of Xeric: Challenge Mode' },
  { name: 'Theatre of Blood', category: 'Raids', wiki_name: 'Theatre of Blood' },
  { name: 'Theatre of Blood: Hard Mode', category: 'Raids', wiki_name: 'Theatre of Blood: Hard Mode' },
  { name: 'Tombs of Amascut', category: 'Raids', wiki_name: 'Tombs of Amascut' },
  { name: 'Tombs of Amascut: Expert Mode', category: 'Raids', wiki_name: 'Tombs of Amascut: Expert Mode' },
];

export const ALL_BOSSES = [...WORLD_BOSSES, ...RAID_BOSSES];
