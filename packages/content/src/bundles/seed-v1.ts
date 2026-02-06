import type {
  CombatAchievement,
  ContentBundle,
  Diary,
  GuideTemplateBundle,
  Quest,
} from '../schema';

import rawCombatAchievements from './combat-achievements-2024-01-31.json';
import rawDiaries from './diaries-2026-01-22.json';
import rawQuestGuide from './quests-ironman-quest-guide.json';

const combatAchievements = (
  rawCombatAchievements as Array<Omit<CombatAchievement, 'requirements'>>
).map((achievement) => ({
  ...achievement,
  requirements: [],
}));

const diaries = rawDiaries as Diary[];

const quests = rawQuestGuide as Quest[];

const guides: GuideTemplateBundle[] = [];

export const seedBundle: ContentBundle = {
  metadata: {
    version: 'seed-2026-01-22',
    publishedAt: '2026-01-22T00:00:00.000Z',
    sources: [
      'seed-placeholder',
      'refdocs/20240131CombatAchievementPointReworkCA.xlsx',
      'refdocs/Ironman Runescape Quest Guide.xlsx',
      'https://oldschool.runescape.wiki/w/Achievement_Diary/All_achievements',
    ],
    checksum: 'seed-2026-01-22',
    notes:
      'Seed bundle is intentionally minimal. Replace with a generated bundle from authoritative sources before production use.',
    questCount: quests.length,
    diaryCount: diaries.length,
    guideCount: 0,
  },
  quests,
  diaries,
  combatAchievements,
  guides,
};
