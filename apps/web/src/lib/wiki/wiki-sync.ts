import type { DbClient } from '@skillbound/database';
import {
  combatAchievementDefinitions,
  questDefinitions,
  eq,
} from '@skillbound/database';
import { createWikiBucketClient } from '@skillbound/wiki-api';

import { logger } from '../logging/logger';

/**
 * Wiki Sync Service
 *
 * Syncs data from OSRS Wiki Bucket API to populate:
 * - Combat achievement names, descriptions, tiers
 * - Quest names, difficulties, requirements
 * - Diary task descriptions
 *
 * This ensures we have actual human-readable content instead of placeholders.
 */

/**
 * Normalize quest name to match our ID format
 */
function normalizeQuestName(questName: string): string {
  return questName
    .toLowerCase()
    .replace(/[''']/g, '_')
    .replace(/…/g, '')
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Sync combat achievements from wiki to database
 */
export async function syncCombatAchievements(db: DbClient): Promise<{
  added: number;
  updated: number;
  total: number;
}> {
  logger.info('Syncing combat achievements from OSRS Wiki...');

  const client = createWikiBucketClient('Skillbound/1.0');
  const wikiAchievements = await client.getCombatAchievements();

  logger.info(
    { count: wikiAchievements.length },
    'Found combat achievements on wiki'
  );

  let added = 0;
  let updated = 0;

  // Use transaction to ensure all-or-nothing batch update
  await db.transaction(async (tx) => {
    for (const wikiCA of wikiAchievements) {
      // Check if exists
      const existing = await tx.query.combatAchievementDefinitions.findFirst({
        where: (ca, { eq }) => eq(ca.runeliteId, wikiCA.id),
      });

      const caId = `ca_${wikiCA.id}`;

      if (existing) {
        // Update if name/tier/task changed
        if (
          existing.name !== wikiCA.name ||
          existing.tier !== wikiCA.tier ||
          existing.description !== wikiCA.task
        ) {
          await tx
            .update(combatAchievementDefinitions)
            .set({
              name: wikiCA.name,
              tier: wikiCA.tier,
              description: wikiCA.task,
              monster: wikiCA.monster ?? null,
              updatedAt: new Date(),
            })
            .where(eq(combatAchievementDefinitions.id, existing.id));
          updated++;
        }
      } else {
        // Add new achievement
        await tx.insert(combatAchievementDefinitions).values({
          id: caId,
          runeliteId: wikiCA.id,
          name: wikiCA.name,
          tier: wikiCA.tier,
          description: wikiCA.task,
          monster: wikiCA.monster ?? null,
          requirements: [],
        });
        added++;
      }
    }
  });

  logger.info(
    { added, updated, total: wikiAchievements.length },
    'Combat achievements sync complete'
  );

  return {
    added,
    updated,
    total: wikiAchievements.length,
  };
}

/**
 * Sync quests from wiki to database
 */
export async function syncQuests(db: DbClient): Promise<{
  added: number;
  updated: number;
  total: number;
}> {
  logger.info('Syncing quests from OSRS Wiki...');

  const client = createWikiBucketClient('Skillbound/1.0');
  const wikiQuests = await client.getQuests();

  logger.info({ count: wikiQuests.length }, 'Found quests on wiki');

  let added = 0;
  let updated = 0;

  // Use transaction to ensure all-or-nothing batch update
  await db.transaction(async (tx) => {
    for (const wikiQuest of wikiQuests) {
      const questId = normalizeQuestName(wikiQuest.name);

      // Check if exists
      const existing = await tx.query.questDefinitions.findFirst({
        where: (q, { eq }) => eq(q.id, questId),
      });

      if (existing) {
        // Update metadata if changed
        if (
          existing.difficulty !== wikiQuest.officialDifficulty ||
          existing.length !== wikiQuest.officialLength
        ) {
          await tx
            .update(questDefinitions)
            .set({
              difficulty: wikiQuest.officialDifficulty ?? null,
              length: wikiQuest.officialLength ?? null,
              description: wikiQuest.description ?? null,
              updatedAt: new Date(),
            })
            .where(eq(questDefinitions.id, questId));
          updated++;
        }
      } else {
        // Add new quest
        await tx.insert(questDefinitions).values({
          id: questId,
          name: wikiQuest.name,
          difficulty: wikiQuest.officialDifficulty ?? null,
          length: wikiQuest.officialLength ?? null,
          description: wikiQuest.description ?? null,
          requirements: [],
        });
        added++;
      }
    }
  });

  logger.info(
    { added, updated, total: wikiQuests.length },
    'Quests sync complete'
  );

  return {
    added,
    updated,
    total: wikiQuests.length,
  };
}

/**
 * Sync all content from wiki
 */
export async function syncAllFromWiki(db: DbClient): Promise<{
  combatAchievements: { added: number; updated: number; total: number };
  quests: { added: number; updated: number; total: number };
}> {
  logger.info('Starting full wiki sync...');

  const combatAchievements = await syncCombatAchievements(db);
  const quests = await syncQuests(db);

  logger.info(
    {
      combatAchievements: combatAchievements.total,
      quests: quests.total,
    },
    'Full wiki sync complete'
  );

  return {
    combatAchievements,
    quests,
  };
}
