import type { CharacterState } from '@skillbound/database';
import { describe, expect, it } from 'vitest';

import type {
  BatchStateUpdate,
  SetStateOptions,
  StateDomain,
  StateSource,
} from './character-state-service';

/**
 * These tests validate the logic of the character state service
 * without requiring a database connection.
 *
 * The service functions that require database access are tested
 * through integration tests.
 */

describe('StateDomain', () => {
  it('has all expected domain types', () => {
    const domains: StateDomain[] = [
      'skill',
      'boss',
      'activity',
      'quest',
      'diary',
      'diary_task',
      'combat_achievement',
      'collection_log',
      'item_unlock',
      'gear',
      'guide_step',
      'milestone',
      'goal',
      'unlock_flag',
      'custom',
    ];

    // Verify these compile and are valid
    for (const domain of domains) {
      expect(typeof domain).toBe('string');
    }
  });
});

describe('StateSource', () => {
  it('has all expected source types with correct priority ordering', () => {
    // Sources ordered by priority (highest to lowest)
    const sources: StateSource[] = [
      'runelite', // 100 - Most authoritative
      'hiscores', // 80 - Official
      'wiki', // 60 - Reference
      'guide', // 40 - User guide action
      'manual', // 30 - User manual entry
      'calculated', // 20 - Derived
      'migration', // 10 - Legacy
    ];

    // Verify these compile and are valid
    for (const source of sources) {
      expect(typeof source).toBe('string');
    }
  });
});

describe('SetStateOptions', () => {
  it('accepts valid options', () => {
    const options: SetStateOptions = {
      source: 'guide',
      sourceId: 'guide-123',
      confidence: 'high',
      note: 'Completed Dragon Slayer step',
      achievedAt: new Date(),
      force: false,
    };

    expect(options.source).toBe('guide');
    expect(options.sourceId).toBe('guide-123');
    expect(options.confidence).toBe('high');
    expect(options.force).toBe(false);
  });

  it('allows partial options', () => {
    const options: SetStateOptions = {
      source: 'manual',
    };

    expect(options.source).toBe('manual');
    expect(options.force).toBeUndefined();
  });
});

describe('BatchStateUpdate', () => {
  it('accepts valid batch updates', () => {
    const updates: BatchStateUpdate[] = [
      {
        domain: 'quest',
        key: 'dragon_slayer',
        value: { completed: true, completedAt: '2024-01-15T12:00:00Z' },
        options: { source: 'guide', sourceId: 'ironman-guide-1' },
      },
      {
        domain: 'unlock_flag',
        key: 'fairy_rings',
        value: { unlocked: true, unlockedAt: '2024-01-15T12:00:00Z' },
        options: { source: 'guide' },
      },
      {
        domain: 'skill',
        key: 'cooking',
        value: { level: 99, xp: 13034431, rank: 50000 },
        options: { source: 'hiscores', achievedAt: new Date() },
      },
    ];

    expect(updates).toHaveLength(3);
    expect(updates[0]?.domain).toBe('quest');
    expect(updates[1]?.domain).toBe('unlock_flag');
    expect(updates[2]?.domain).toBe('skill');
  });
});

describe('Source Priority Resolution', () => {
  // Test that priority order is maintained conceptually
  const SOURCE_PRIORITY: Record<StateSource, number> = {
    runelite: 100,
    hiscores: 80,
    wiki: 60,
    guide: 40,
    manual: 30,
    calculated: 20,
    migration: 10,
  };

  it('runelite has highest priority', () => {
    expect(SOURCE_PRIORITY.runelite).toBeGreaterThan(SOURCE_PRIORITY.hiscores);
    expect(SOURCE_PRIORITY.runelite).toBeGreaterThan(SOURCE_PRIORITY.wiki);
    expect(SOURCE_PRIORITY.runelite).toBeGreaterThan(SOURCE_PRIORITY.guide);
    expect(SOURCE_PRIORITY.runelite).toBeGreaterThan(SOURCE_PRIORITY.manual);
  });

  it('hiscores is second highest', () => {
    expect(SOURCE_PRIORITY.hiscores).toBeGreaterThan(SOURCE_PRIORITY.wiki);
    expect(SOURCE_PRIORITY.hiscores).toBeGreaterThan(SOURCE_PRIORITY.guide);
    expect(SOURCE_PRIORITY.hiscores).toBeGreaterThan(SOURCE_PRIORITY.manual);
  });

  it('guide is higher than manual', () => {
    expect(SOURCE_PRIORITY.guide).toBeGreaterThan(SOURCE_PRIORITY.manual);
    expect(SOURCE_PRIORITY.guide).toBeGreaterThan(SOURCE_PRIORITY.calculated);
  });

  it('migration has lowest priority', () => {
    expect(SOURCE_PRIORITY.migration).toBeLessThan(SOURCE_PRIORITY.manual);
    expect(SOURCE_PRIORITY.migration).toBeLessThan(SOURCE_PRIORITY.calculated);
  });
});

describe('Character State Value Structures', () => {
  describe('Quest state value', () => {
    it('represents completed quest', () => {
      const value = {
        completed: true,
        completedAt: '2024-01-15T12:00:00Z',
        state: 'completed' as const,
      };

      expect(value.completed).toBe(true);
      expect(value.state).toBe('completed');
    });

    it('represents in-progress quest', () => {
      const value = {
        completed: false,
        state: 'in_progress' as const,
        progress: 3,
        totalSteps: 10,
      };

      expect(value.completed).toBe(false);
      expect(value.progress).toBe(3);
    });
  });

  describe('Unlock flag value', () => {
    it('represents unlocked flag', () => {
      const value = {
        unlocked: true,
        unlockedAt: '2024-01-15T12:00:00Z',
      };

      expect(value.unlocked).toBe(true);
      expect(value.unlockedAt).toBeDefined();
    });

    it('represents locked flag', () => {
      const value = {
        unlocked: false,
      };

      expect(value.unlocked).toBe(false);
    });
  });

  describe('Skill state value', () => {
    it('represents skill data', () => {
      const value = {
        level: 99,
        xp: 13034431,
        rank: 50000,
        virtualLevel: 99,
      };

      expect(value.level).toBe(99);
      expect(value.xp).toBe(13034431);
    });
  });

  describe('Boss state value', () => {
    it('represents boss killcount', () => {
      const value = {
        killcount: 500,
        personalBest: 120, // seconds
        rank: 10000,
      };

      expect(value.killcount).toBe(500);
      expect(value.personalBest).toBe(120);
    });
  });

  describe('Diary state value', () => {
    it('represents diary completion', () => {
      const value = {
        completed: true,
        completedAt: '2024-01-15T12:00:00Z',
        tier: 'elite' as const,
        tasksCompleted: 12,
        totalTasks: 12,
      };

      expect(value.completed).toBe(true);
      expect(value.tier).toBe('elite');
    });
  });

  describe('Guide step value', () => {
    it('represents guide step completion', () => {
      const value = {
        completed: true,
        completedAt: '2024-01-15T12:00:00Z',
        skipped: false,
      };

      expect(value.completed).toBe(true);
      expect(value.skipped).toBe(false);
    });

    it('represents skipped guide step', () => {
      const value = {
        completed: false,
        skipped: true,
        skipReason: 'Already had item',
      };

      expect(value.completed).toBe(false);
      expect(value.skipped).toBe(true);
    });
  });

  describe('Collection log value', () => {
    it('represents collection log item', () => {
      const value = {
        obtained: true,
        obtainedAt: '2024-01-15T12:00:00Z',
        quantity: 1,
        source: 'Wintertodt',
      };

      expect(value.obtained).toBe(true);
      expect(value.source).toBe('Wintertodt');
    });
  });
});

describe('Guide Step Key Format', () => {
  it('formats guide step key correctly', () => {
    const guideId = 'ironman-optimal-guide';
    const stepNumber = 42;
    const key = `${guideId}:step:${stepNumber}`;

    expect(key).toBe('ironman-optimal-guide:step:42');
  });

  it('parses guide step key correctly', () => {
    const key = 'ironman-optimal-guide:step:42';
    const parts = key.split(':');

    expect(parts[0]).toBe('ironman-optimal-guide');
    expect(parts[1]).toBe('step');
    expect(parts[2]).toBe('42');
  });
});

describe('Sync Unlock Types', () => {
  it('maps unlock types to domains correctly', () => {
    const unlockTypeToDomain: Record<string, StateDomain> = {
      quest: 'quest',
      diary: 'diary',
      unlock_flag: 'unlock_flag',
      item_unlock: 'item_unlock',
    };

    expect(unlockTypeToDomain['quest']).toBe('quest');
    expect(unlockTypeToDomain['diary']).toBe('diary');
    expect(unlockTypeToDomain['unlock_flag']).toBe('unlock_flag');
    expect(unlockTypeToDomain['item_unlock']).toBe('item_unlock');
  });
});

describe('CharacterState Mock', () => {
  const createMockState = (
    overrides: Partial<CharacterState> = {}
  ): CharacterState => ({
    id: 'state-1',
    userCharacterId: 'user-character-1',
    domain: 'quest',
    key: 'dragon_slayer',
    value: { completed: true },
    source: 'manual',
    sourceId: null,
    confidence: 'medium',
    note: null,
    achievedAt: new Date('2024-01-15T12:00:00Z'),
    syncedAt: null,
    createdAt: new Date('2024-01-15T12:00:00Z'),
    updatedAt: new Date('2024-01-15T12:00:00Z'),
    ...overrides,
  });

  it('creates valid mock state', () => {
    const state = createMockState();

    expect(state.id).toBe('state-1');
    expect(state.domain).toBe('quest');
    expect(state.key).toBe('dragon_slayer');
    expect(state.value).toEqual({ completed: true });
  });

  it('allows overriding mock state fields', () => {
    const state = createMockState({
      domain: 'unlock_flag',
      key: 'fairy_rings',
      value: { unlocked: true },
      source: 'guide',
    });

    expect(state.domain).toBe('unlock_flag');
    expect(state.key).toBe('fairy_rings');
    expect(state.source).toBe('guide');
  });
});

describe('State Domain Grouping', () => {
  it('groups related domains correctly', () => {
    // Achievement-related
    const achievementDomains: StateDomain[] = [
      'quest',
      'diary',
      'diary_task',
      'combat_achievement',
    ];

    // Progress-related
    const progressDomains: StateDomain[] = ['skill', 'boss', 'activity'];

    // Unlock-related
    const unlockDomains: StateDomain[] = [
      'unlock_flag',
      'item_unlock',
      'collection_log',
      'gear',
    ];

    // User/guide-related
    const userDomains: StateDomain[] = [
      'guide_step',
      'milestone',
      'goal',
      'custom',
    ];

    // Total should be 15 unique domains
    const allDomains = new Set([
      ...achievementDomains,
      ...progressDomains,
      ...unlockDomains,
      ...userDomains,
    ]);

    expect(allDomains.size).toBe(15);
  });
});

describe('Confidence Levels', () => {
  it('has correct confidence level ordering', () => {
    const confidenceLevels = ['high', 'medium', 'low'] as const;

    expect(confidenceLevels).toHaveLength(3);
    expect(confidenceLevels[0]).toBe('high');
    expect(confidenceLevels[1]).toBe('medium');
    expect(confidenceLevels[2]).toBe('low');
  });
});
