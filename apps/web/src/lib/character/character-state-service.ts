/**
 * Character State Service
 *
 * Provides a unified interface for managing character state across all features.
 * Uses the character_state table as a single source of truth for:
 * - Skills, bosses, activities
 * - Quest and diary completion
 * - Unlock flags (fairy rings, spirit trees, etc.)
 * - Collection log items
 * - Guide progress
 * - Custom milestones and goals
 *
 * This service enables:
 * - Cross-feature sync (guide completion -> permanent state)
 * - Efficient queries (all state in one table)
 * - Conflict resolution (source priority)
 * - Historical tracking (achievedAt timestamps)
 */

import {
  and,
  characterState,
  eq,
  inArray,
  sql,
  userCharacters,
  type CharacterState,
  type NewCharacterState,
} from '@skillbound/database';

import { getDbClient } from '../db';
import { logger } from '../logging/logger';

// Re-export types from schema
export type {
  BossStateValue,
  CharacterState,
  CharacterStateValue,
  CollectionLogValue,
  DiaryStateValue,
  GuideStepValue,
  QuestStateValue,
  SkillStateValue,
  UnlockFlagValue,
} from '@skillbound/database';

/**
 * Domain types for character state
 */
export type StateDomain =
  | 'skill'
  | 'boss'
  | 'activity'
  | 'quest'
  | 'diary'
  | 'diary_task'
  | 'combat_achievement'
  | 'collection_log'
  | 'item_unlock'
  | 'gear'
  | 'guide_step'
  | 'milestone'
  | 'goal'
  | 'unlock_flag'
  | 'custom';

/**
 * Source types for state data
 */
export type StateSource =
  | 'hiscores'
  | 'runelite'
  | 'wiki'
  | 'guide'
  | 'manual'
  | 'calculated'
  | 'migration';

/**
 * Source priority for conflict resolution (higher = more authoritative)
 */
const SOURCE_PRIORITY: Record<StateSource, number> = {
  runelite: 100, // Most authoritative (direct game data)
  hiscores: 80, // Official but limited
  wiki: 60, // Reference data
  guide: 40, // User action in guide
  manual: 30, // User manually set
  calculated: 20, // Derived from other data
  migration: 10, // Migrated from legacy tables
};

/**
 * Options for setting state
 */
export interface SetStateOptions {
  /** Source of the state data */
  source?: StateSource | undefined;
  /** Optional source ID (e.g., guide ID, sync job ID) */
  sourceId?: string | undefined;
  /** Confidence level */
  confidence?: 'high' | 'medium' | 'low' | undefined;
  /** User note */
  note?: string | undefined;
  /** When the state was achieved in-game */
  achievedAt?: Date | undefined;
  /** Force update even if lower priority source */
  force?: boolean | undefined;
}

/**
 * Options for querying state
 */
export interface GetStateOptions {
  /** Filter by domains */
  domains?: StateDomain[] | undefined;
  /** Filter by source */
  source?: StateSource | undefined;
  /** Include only achieved/completed items */
  achievedOnly?: boolean | undefined;
}

/**
 * Batch update item
 */
export interface BatchStateUpdate {
  domain: StateDomain;
  key: string;
  value: Record<string, unknown>;
  options?: SetStateOptions;
}

/**
 * Get a single state value for a character
 */
export async function getState(
  characterId: string,
  domain: StateDomain,
  key: string
): Promise<CharacterState | null> {
  const db = getDbClient();

  const [result] = await db
    .select()
    .from(characterState)
    .where(
      and(
        eq(characterState.userCharacterId, characterId),
        eq(characterState.domain, domain),
        eq(characterState.key, key)
      )
    )
    .limit(1);

  return result ?? null;
}

/**
 * Get multiple state values for a character
 */
export async function getStates(
  characterId: string,
  options: GetStateOptions = {}
): Promise<CharacterState[]> {
  const db = getDbClient();

  const conditions = [eq(characterState.userCharacterId, characterId)];

  if (options.domains && options.domains.length > 0) {
    conditions.push(inArray(characterState.domain, options.domains));
  }

  if (options.source) {
    conditions.push(eq(characterState.source, options.source));
  }

  if (options.achievedOnly) {
    conditions.push(sql`${characterState.achievedAt} IS NOT NULL`);
  }

  return db
    .select()
    .from(characterState)
    .where(and(...conditions))
    .orderBy(characterState.domain, characterState.key);
}

/**
 * Get all state for a specific domain
 */
export async function getDomainState(
  characterId: string,
  domain: StateDomain
): Promise<CharacterState[]> {
  return getStates(characterId, { domains: [domain] });
}

/**
 * Set a state value for a character
 * Handles conflict resolution based on source priority
 */
export async function setState(
  characterId: string,
  domain: StateDomain,
  key: string,
  value: Record<string, unknown>,
  options: SetStateOptions = {}
): Promise<CharacterState> {
  const {
    source = 'manual',
    sourceId,
    confidence = 'medium',
    note,
    achievedAt,
    force = false,
  } = options;

  const db = getDbClient();

  // Check existing state for conflict resolution
  const existing = await getState(characterId, domain, key);

  if (existing && !force) {
    const existingPriority = SOURCE_PRIORITY[existing.source as StateSource] ?? 0;
    const newPriority = SOURCE_PRIORITY[source] ?? 0;

    // Don't overwrite with lower priority source
    if (newPriority < existingPriority) {
      logger.debug(
        { characterId, domain, key, existingSource: existing.source, newSource: source },
        'Skipping state update due to lower priority source'
      );
      return existing;
    }
  }

  const now = new Date();
  const stateData: NewCharacterState = {
    userCharacterId: characterId,
    domain,
    key,
    value,
    source,
    sourceId: sourceId ?? null,
    confidence,
    note: note ?? null,
    achievedAt: achievedAt ?? null,
    syncedAt: source === 'hiscores' || source === 'runelite' ? now : null,
    updatedAt: now,
  };

  const [result] = await db
    .insert(characterState)
    .values(stateData)
    .onConflictDoUpdate({
      target: [
        characterState.userCharacterId,
        characterState.domain,
        characterState.key,
      ],
      set: {
        value,
        source,
        sourceId: sourceId ?? null,
        confidence,
        note: note ?? null,
        achievedAt: achievedAt ?? sql`COALESCE(${characterState.achievedAt}, ${achievedAt ?? null})`,
        syncedAt: source === 'hiscores' || source === 'runelite' ? now : characterState.syncedAt,
        updatedAt: now,
      },
    })
    .returning();

  if (!result) {
    throw new Error('Failed to set character state');
  }

  logger.debug(
    { characterId, domain, key, source },
    'Updated character state'
  );

  return result;
}

/**
 * Set multiple state values in a single transaction
 */
export async function setStates(
  characterId: string,
  updates: BatchStateUpdate[]
): Promise<CharacterState[]> {
  const db = getDbClient();
  const results: CharacterState[] = [];

  await db.transaction(async (tx) => {
    for (const update of updates) {
      const {
        source = 'manual',
        sourceId,
        confidence = 'medium',
        note,
        achievedAt,
      } = update.options ?? {};

      const now = new Date();
      const stateData: NewCharacterState = {
        userCharacterId: characterId,
        domain: update.domain,
        key: update.key,
        value: update.value,
        source,
        sourceId: sourceId ?? null,
        confidence,
        note: note ?? null,
        achievedAt: achievedAt ?? null,
        syncedAt: source === 'hiscores' || source === 'runelite' ? now : null,
        updatedAt: now,
      };

      const [result] = await tx
        .insert(characterState)
        .values(stateData)
        .onConflictDoUpdate({
          target: [
            characterState.userCharacterId,
            characterState.domain,
            characterState.key,
          ],
          set: {
            value: update.value,
            source,
            sourceId: sourceId ?? null,
            confidence,
            note: note ?? null,
            achievedAt: achievedAt ?? sql`COALESCE(${characterState.achievedAt}, ${achievedAt ?? null})`,
            syncedAt: source === 'hiscores' || source === 'runelite' ? now : characterState.syncedAt,
            updatedAt: now,
          },
        })
        .returning();

      if (result) {
        results.push(result);
      }
    }
  });

  logger.info(
    { characterId, updateCount: updates.length },
    'Batch updated character state'
  );

  return results;
}

/**
 * Delete a state value
 */
export async function deleteState(
  characterId: string,
  domain: StateDomain,
  key: string
): Promise<boolean> {
  const db = getDbClient();

  const result = await db
    .delete(characterState)
    .where(
      and(
        eq(characterState.userCharacterId, characterId),
        eq(characterState.domain, domain),
        eq(characterState.key, key)
      )
    )
    .returning({ id: characterState.id });

  return result.length > 0;
}

/**
 * Check if a character has a specific unlock/completion
 */
export async function hasUnlock(
  characterId: string,
  key: string
): Promise<boolean> {
  const state = await getState(characterId, 'unlock_flag', key);
  if (!state) return false;

  const value = state.value as { unlocked?: boolean };
  return value.unlocked === true;
}

/**
 * Check if a quest is completed
 */
export async function isQuestComplete(
  characterId: string,
  questKey: string
): Promise<boolean> {
  const state = await getState(characterId, 'quest', questKey);
  if (!state) return false;

  const value = state.value as { completed?: boolean };
  return value.completed === true;
}

/**
 * Check if a diary tier is completed
 */
export async function isDiaryComplete(
  characterId: string,
  diaryKey: string // e.g., "lumbridge_easy"
): Promise<boolean> {
  const state = await getState(characterId, 'diary', diaryKey);
  if (!state) return false;

  const value = state.value as { completed?: boolean };
  return value.completed === true;
}

/**
 * Set an unlock flag
 */
export async function setUnlock(
  characterId: string,
  key: string,
  unlocked: boolean,
  options: SetStateOptions = {}
): Promise<CharacterState> {
  return setState(
    characterId,
    'unlock_flag',
    key,
    {
      unlocked,
      unlockedAt: unlocked ? new Date().toISOString() : undefined,
    },
    {
      ...options,
      achievedAt: unlocked ? options.achievedAt ?? new Date() : undefined,
    }
  );
}

/**
 * Set quest completion status
 */
export async function setQuestComplete(
  characterId: string,
  questKey: string,
  completed: boolean,
  options: SetStateOptions = {}
): Promise<CharacterState> {
  return setState(
    characterId,
    'quest',
    questKey,
    {
      completed,
      completedAt: completed ? new Date().toISOString() : undefined,
      state: completed ? 'completed' : 'not_started',
    },
    {
      ...options,
      achievedAt: completed ? options.achievedAt ?? new Date() : undefined,
    }
  );
}

/**
 * Set diary completion status
 */
export async function setDiaryComplete(
  characterId: string,
  diaryKey: string, // e.g., "lumbridge_easy"
  completed: boolean,
  options: SetStateOptions = {}
): Promise<CharacterState> {
  return setState(
    characterId,
    'diary',
    diaryKey,
    {
      completed,
      completedAt: completed ? new Date().toISOString() : undefined,
    },
    {
      ...options,
      achievedAt: completed ? options.achievedAt ?? new Date() : undefined,
    }
  );
}

/**
 * Set guide step completion
 */
export async function setGuideStepComplete(
  characterId: string,
  guideId: string,
  stepNumber: number,
  completed: boolean,
  options: SetStateOptions = {}
): Promise<CharacterState> {
  const key = `${guideId}:step:${stepNumber}`;

  return setState(
    characterId,
    'guide_step',
    key,
    {
      completed,
      completedAt: completed ? new Date().toISOString() : undefined,
    },
    {
      source: 'guide',
      sourceId: guideId,
      ...options,
      achievedAt: completed ? options.achievedAt ?? new Date() : undefined,
    }
  );
}

/**
 * Sync unlocks from a completed guide step
 * This is the key function for cross-feature sync
 */
export async function syncGuideStepUnlocks(
  characterId: string,
  guideId: string,
  stepNumber: number,
  unlocks: Array<{
    type: 'quest' | 'diary' | 'unlock_flag' | 'item_unlock';
    key: string;
    value?: Record<string, unknown>;
  }>
): Promise<CharacterState[]> {
  const updates: BatchStateUpdate[] = [];

  for (const unlock of unlocks) {
    let domain: StateDomain;
    let value: Record<string, unknown>;

    switch (unlock.type) {
      case 'quest':
        domain = 'quest';
        value = { completed: true, completedAt: new Date().toISOString(), state: 'completed' };
        break;
      case 'diary':
        domain = 'diary';
        value = { completed: true, completedAt: new Date().toISOString() };
        break;
      case 'unlock_flag':
        domain = 'unlock_flag';
        value = { unlocked: true, unlockedAt: new Date().toISOString() };
        break;
      case 'item_unlock':
        domain = 'item_unlock';
        value = { unlocked: true, unlockedAt: new Date().toISOString() };
        break;
      default:
        continue;
    }

    updates.push({
      domain,
      key: unlock.key,
      value: unlock.value ?? value,
      options: {
        source: 'guide',
        sourceId: guideId,
        achievedAt: new Date(),
      },
    });
  }

  if (updates.length === 0) {
    return [];
  }

  logger.info(
    { characterId, guideId, stepNumber, unlockCount: updates.length },
    'Syncing guide step unlocks to character state'
  );

  return setStates(characterId, updates);
}

/**
 * Get all unlocks for a character
 */
export async function getAllUnlocks(
  characterId: string
): Promise<Array<{ key: string; unlocked: boolean; unlockedAt: string | null }>> {
  const states = await getDomainState(characterId, 'unlock_flag');

  return states.map((state) => {
    const value = state.value as { unlocked?: boolean; unlockedAt?: string };
    return {
      key: state.key,
      unlocked: value.unlocked ?? false,
      unlockedAt: value.unlockedAt ?? null,
    };
  });
}

/**
 * Get all completed quests for a character
 */
export async function getCompletedQuests(
  characterId: string
): Promise<Array<{ key: string; completedAt: string | null }>> {
  const states = await getDomainState(characterId, 'quest');

  return states
    .filter((state) => {
      const value = state.value as { completed?: boolean };
      return value.completed === true;
    })
    .map((state) => {
      const value = state.value as { completedAt?: string };
      return {
        key: state.key,
        completedAt: value.completedAt ?? null,
      };
    });
}

/**
 * Get character state summary for dashboard
 */
export async function getCharacterStateSummary(
  characterId: string
): Promise<{
  totalStates: number;
  byDomain: Record<StateDomain, number>;
  recentUpdates: CharacterState[];
  questsCompleted: number;
  diariesCompleted: number;
  unlocksObtained: number;
}> {
  const db = getDbClient();

  // Count by domain
  const domainCounts = await db
    .select({
      domain: characterState.domain,
      count: sql<number>`count(*)`,
    })
    .from(characterState)
    .where(eq(characterState.userCharacterId, characterId))
    .groupBy(characterState.domain);

  const byDomain: Record<StateDomain, number> = {
    skill: 0,
    boss: 0,
    activity: 0,
    quest: 0,
    diary: 0,
    diary_task: 0,
    combat_achievement: 0,
    collection_log: 0,
    item_unlock: 0,
    gear: 0,
    guide_step: 0,
    milestone: 0,
    goal: 0,
    unlock_flag: 0,
    custom: 0,
  };

  let totalStates = 0;
  for (const row of domainCounts) {
    byDomain[row.domain as StateDomain] = Number(row.count);
    totalStates += Number(row.count);
  }

  // Recent updates
  const recentUpdates = await db
    .select()
    .from(characterState)
    .where(eq(characterState.userCharacterId, characterId))
    .orderBy(sql`${characterState.updatedAt} DESC`)
    .limit(10);

  // Count completed quests
  const [questCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(characterState)
    .where(
      and(
        eq(characterState.userCharacterId, characterId),
        eq(characterState.domain, 'quest'),
        sql`(${characterState.value}->>'completed')::boolean = true`
      )
    );

  // Count completed diaries
  const [diaryCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(characterState)
    .where(
      and(
        eq(characterState.userCharacterId, characterId),
        eq(characterState.domain, 'diary'),
        sql`(${characterState.value}->>'completed')::boolean = true`
      )
    );

  // Count unlocks
  const [unlockCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(characterState)
    .where(
      and(
        eq(characterState.userCharacterId, characterId),
        eq(characterState.domain, 'unlock_flag'),
        sql`(${characterState.value}->>'unlocked')::boolean = true`
      )
    );

  return {
    totalStates,
    byDomain,
    recentUpdates,
    questsCompleted: Number(questCount?.count ?? 0),
    diariesCompleted: Number(diaryCount?.count ?? 0),
    unlocksObtained: Number(unlockCount?.count ?? 0),
  };
}

/**
 * Verify character ownership before state operations
 */
export async function verifyCharacterOwnership(
  characterId: string,
  userId: string
): Promise<boolean> {
  const db = getDbClient();

  const [character] = await db
    .select({ id: userCharacters.id })
    .from(userCharacters)
    .where(
      and(eq(userCharacters.id, characterId), eq(userCharacters.userId, userId))
    )
    .limit(1);

  return !!character;
}
