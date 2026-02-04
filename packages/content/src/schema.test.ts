import { describe, expect, it } from 'vitest';

import { parseContentBundle, seedBundle } from './index';

describe('content bundle schema', () => {
  it('parses the seed bundle', () => {
    const parsed = parseContentBundle(seedBundle);

    expect(parsed.metadata.version).toBe('seed-2026-01-22');
    expect(parsed.quests.length).toBe(seedBundle.quests.length);
    expect(parsed.diaries.length).toBe(seedBundle.diaries.length);
    expect(parsed.combatAchievements.length).toBe(
      seedBundle.combatAchievements.length
    );
  });

  it('includes quest requirements from the seed data', () => {
    const parsed = parseContentBundle(seedBundle);
    const animalMagnetism = parsed.quests.find(
      (quest) => quest.id === 'animal_magnetism'
    );

    expect(animalMagnetism?.requirements.length).toBeGreaterThan(0);
  });

  it('includes diary tasks from the seed data', () => {
    const parsed = parseContentBundle(seedBundle);
    const ardougne = parsed.diaries.find((diary) => diary.id === 'ardougne');
    const eliteTier = ardougne?.tiers.find((tier) => tier.tier === 'elite');

    expect(parsed.diaries.length).toBeGreaterThan(0);
    expect(eliteTier?.tasks.length).toBeGreaterThan(0);
  });

  it('rejects invalid requirements', () => {
    expect(() =>
      parseContentBundle({
        metadata: {
          version: 'test',
          publishedAt: '2026-01-22T00:00:00.000Z',
          sources: ['test'],
          checksum: 'test',
        },
        quests: [
          {
            id: 'bad',
            name: 'Bad Quest',
            requirements: [
              {
                type: 'skill-level',
                skill: 'attack',
                level: 0,
              },
            ],
          },
        ],
        diaries: [],
        combatAchievements: [],
      })
    ).toThrow();
  });

  it('accepts activity score and combat achievement requirements', () => {
    const parsed = parseContentBundle({
      metadata: {
        version: 'test',
        publishedAt: '2026-01-22T00:00:00.000Z',
        sources: ['test'],
        checksum: 'test',
      },
      quests: [
        {
          id: 'activity-test',
          name: 'Activity Test',
          requirements: [
            {
              type: 'activity-score',
              activityKey: 'barrows',
              score: 10,
            },
            {
              type: 'manual-check',
              label: 'Manual unlock required',
            },
            {
              type: 'combined-skill-level',
              skills: ['attack', 'strength'],
              totalLevel: 130,
            },
            {
              type: 'combat-level',
              level: 90,
            },
          ],
        },
      ],
      diaries: [],
      combatAchievements: [
        {
          id: 'barrows_novice',
          runeliteId: 123,
          name: 'Barrows Novice',
          monster: 'Barrows',
          description: 'Open the Barrows chest 10 times.',
          tier: 'Easy',
          points: 1,
          requirements: [
            {
              type: 'combat-achievement',
              achievementId: 'barrows_novice',
            },
          ],
        },
      ],
    });

    expect(parsed.quests[0]?.id).toBe('activity-test');
    expect(parsed.combatAchievements[0]?.id).toBe('barrows_novice');
  });
});
