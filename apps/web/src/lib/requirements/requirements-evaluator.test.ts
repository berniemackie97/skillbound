import type { ContentBundle } from '@skillbound/content';
import type { CharacterFacts } from '@skillbound/domain';
import { describe, expect, it } from 'vitest';

import { evaluateBundleCombatAchievements } from './requirements-evaluator';

const bundle: ContentBundle = {
  metadata: {
    version: 'test',
    publishedAt: '2026-01-22T00:00:00.000Z',
    sources: ['test'],
    checksum: 'test',
  },
  quests: [],
  diaries: [],
  combatAchievements: [
    {
      id: 'barrows_novice',
      name: 'Barrows Novice',
      monster: 'Barrows',
      description: 'Open the Barrows chest 10 times.',
      tier: 'Easy',
      points: 1,
      requirements: [
        {
          type: 'activity-score',
          activityKey: 'barrows',
          score: 10,
        },
      ],
    },
  ],
};

describe('evaluateBundleCombatAchievements', () => {
  it('evaluates combat achievements and completion status', () => {
    const facts: CharacterFacts = {
      activities: { barrows: 12 },
      combatAchievements: { barrows_novice: true },
    };

    const results = evaluateBundleCombatAchievements(bundle, facts);

    expect(results).toHaveLength(1);
    expect(results[0]?.completionStatus).toBe('MET');
    expect(results[0]?.requirements.status).toBe('MET');
  });
});
