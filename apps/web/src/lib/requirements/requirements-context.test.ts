import type { CharacterOverride } from '@skillbound/database';
import type { SkillSnapshot } from '@skillbound/domain';
import type { HiscoresResponse } from '@skillbound/hiscores';
import { describe, expect, it } from 'vitest';

import {
  buildCharacterFacts,
  buildCharacterFactsFromSnapshot,
} from './requirements-context';

describe('buildCharacterFactsFromSnapshot', () => {
  it('builds facts with skill levels and overrides', () => {
    const skills: SkillSnapshot[] = [
      { name: 'attack', level: 10, xp: 1154, rank: null },
    ];

    const overrides: CharacterOverride[] = [
      {
        id: 'override-1',
        userCharacterId: 'user-character-1',
        type: 'quest_complete',
        key: 'dragon_slayer',
        value: true,
        note: null,
        updatedAt: new Date(),
        createdAt: new Date(),
      },
      {
        id: 'override-2',
        userCharacterId: 'user-character-1',
        type: 'item_possessed',
        key: '4151',
        value: false,
        note: null,
        updatedAt: new Date(),
        createdAt: new Date(),
      },
    ];

    const facts = buildCharacterFactsFromSnapshot(skills, overrides);

    expect(facts.skillLevels?.attack).toBe(10);
    expect(facts.quests?.['dragon_slayer']).toBe(true);
    expect(facts.items?.[4151]).toBe(false);
  });

  it('includes activities and combat achievement overrides', () => {
    const skills: SkillSnapshot[] = [
      { name: 'attack', level: 5, xp: 100, rank: null },
    ];

    const overrides: CharacterOverride[] = [
      {
        id: 'override-3',
        userCharacterId: 'user-character-1',
        type: 'combat_achievement',
        key: 'barrows_novice',
        value: true,
        note: null,
        updatedAt: new Date(),
        createdAt: new Date(),
      },
    ];

    const activities = { barrows: 12 };
    const facts = buildCharacterFactsFromSnapshot(
      skills,
      overrides,
      activities
    );

    expect(facts.activities?.['barrows']).toBe(12);
    expect(facts.combatAchievements?.['barrows_novice']).toBe(true);
  });
});

describe('buildCharacterFacts', () => {
  it('includes activities from hiscores and combat achievement overrides', () => {
    const hiscores: HiscoresResponse = {
      username: 'Test',
      displayName: 'Test',
      mode: 'normal',
      capturedAt: '2026-01-22T00:00:00.000Z',
      skills: [
        {
          id: 1,
          name: 'Attack',
          key: 'attack',
          isKnownSkill: true,
          rank: 1,
          level: 50,
          xp: 101333,
        },
      ],
      activities: [
        { id: 0, name: 'Barrows', key: 'barrows', rank: 1, score: 15 },
      ],
    };

    const overrides: CharacterOverride[] = [
      {
        id: 'override-4',
        userCharacterId: 'user-character-1',
        type: 'combat_achievement',
        key: 'barrows_novice',
        value: true,
        note: null,
        updatedAt: new Date(),
        createdAt: new Date(),
      },
    ];

    const facts = buildCharacterFacts(hiscores, overrides);

    expect(facts.skillLevels?.attack).toBe(50);
    expect(facts.activities?.['barrows']).toBe(15);
    expect(facts.combatAchievements?.['barrows_novice']).toBe(true);
  });
});
