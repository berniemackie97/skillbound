import type { DbClient } from '@skillbound/database';
import {
  SKILLS,
  type Requirement,
  type SkillName,
} from '@skillbound/domain';
import {
  combatAchievementDefinitions,
  diaryDefinitions,
  diaryTaskDefinitions,
  diaryTierDefinitions,
  questDefinitions,
  eq,
} from '@skillbound/database';
import {
  createMediaWikiClient,
  createWikiBucketClient,
  createWikiPricesClient,
  parseInfobox,
  type WikiPage,
} from '@skillbound/wiki-api';

import { logger } from '../logging/logger';
import {
  buildWikiUrl,
  normalizeItemName,
  parseQuestItemRequirements,
  parseQuestRequirementBlocks,
  parseWikitextRequirements,
} from './wiki-requirements';
import { normalizeQuestName } from './wiki-utils';

/**
 * Wiki Sync Service
 *
 * Syncs data from OSRS Wiki APIs to populate:
 * - Combat achievement names, descriptions, tiers (Bucket API)
 * - Quest names, difficulties, requirements, recommendations, quest points (Bucket + MediaWiki)
 * - Diary tasks and requirements (MediaWiki)
 *
 * This ensures we have actual human-readable content instead of placeholders.
 */

/**
 * Normalize quest name to match our ID format
 */

/**
 * Sync combat achievements from wiki to database
 */
export async function syncCombatAchievements(db: DbClient): Promise<{
  added: number;
  updated: number;
  total: number;
}> {
  logger.info('Syncing combat achievements from OSRS Wiki...');

  const userAgent = getUserAgent();
  const client = createWikiBucketClient(userAgent);
  const wikiAchievements = await client.getCombatAchievements();
  const combatAchievementsUrl =
    'https://oldschool.runescape.wiki/w/Combat_Achievements/All_tasks';

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

      const caId = `combat_achievement_${wikiCA.id}`;

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
              wikiUrl: combatAchievementsUrl,
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
          wikiUrl: combatAchievementsUrl,
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

  const userAgent = getUserAgent();
  const bucketClient = createWikiBucketClient(userAgent);
  const wikiQuests = await bucketClient.getQuests();
  const mediawikiClient = createMediaWikiClient(userAgent);
  const itemMap = await buildItemNameMap(userAgent);
  const questPages = await mediawikiClient.getMultiplePages(
    wikiQuests.map((quest) => quest.name)
  );

  logger.info({ count: wikiQuests.length }, 'Found quests on wiki');

  const knownQuestIds = new Set(
    wikiQuests.map((quest) => normalizeQuestName(quest.name))
  );

  let added = 0;
  let updated = 0;

  // Use transaction to ensure all-or-nothing batch update
  await db.transaction(async (tx) => {
    for (const wikiQuest of wikiQuests) {
      const questId = normalizeQuestName(wikiQuest.name);
      const { required, manual } = parseQuestRequirementBlocks(
        wikiQuest.requirements,
        knownQuestIds
      );
      const itemRequirements = parseQuestItemRequirements(
        wikiQuest.itemsRequired,
        itemMap,
        knownQuestIds
      );
      const questDetails = parseQuestDetails(questPages.get(wikiQuest.name));
      const recommended = parseWikitextRequirements(questDetails.recommended, {
        knownQuestIds,
        itemMap,
      });
      const optionalRequirements = dedupeRequirements([
        ...recommended.requirements,
        ...recommended.manual,
      ]);
      const requiredRequirements = dedupeRequirements([
        ...required,
        ...manual,
        ...itemRequirements.requirements,
        ...itemRequirements.manual,
      ]);
      const wikiUrl = buildWikiUrl(wikiQuest.name);

      // Check if exists
      const existing = await tx.query.questDefinitions.findFirst({
        where: (q, { eq }) => eq(q.id, questId),
      });

      if (existing) {
        // Update metadata if changed
        if (
          existing.difficulty !== wikiQuest.officialDifficulty ||
          existing.length !== wikiQuest.officialLength ||
          existing.questPoints !== (questDetails.questPoints ?? null) ||
          JSON.stringify(existing.requirements ?? []) !==
            JSON.stringify(requiredRequirements) ||
          JSON.stringify(existing.optionalRequirements ?? []) !==
            JSON.stringify(optionalRequirements)
        ) {
          await tx
            .update(questDefinitions)
            .set({
              difficulty: wikiQuest.officialDifficulty ?? null,
              length: wikiQuest.officialLength ?? null,
              description: wikiQuest.description ?? null,
              questPoints: questDetails.questPoints ?? null,
              requirements: requiredRequirements,
              optionalRequirements,
              wikiUrl,
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
          questPoints: questDetails.questPoints ?? null,
          requirements: requiredRequirements,
          optionalRequirements,
          wikiUrl,
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
 * Sync achievement diaries from OSRS Wiki to database
 */
export async function syncDiaries(db: DbClient): Promise<{
  added: number;
  updated: number;
  tasksAdded: number;
  tasksUpdated: number;
}> {
  logger.info('Syncing achievement diaries from OSRS Wiki...');

  const userAgent = getUserAgent();
  const mediawikiClient = createMediaWikiClient(userAgent);
  const diaries = await mediawikiClient.getAllDiaries();
  const itemMap = await buildItemNameMap(userAgent);
  const questIds = await db.query.questDefinitions.findMany({
    columns: { id: true },
  });
  const knownQuestIds = new Set(questIds.map((quest) => quest.id));

  let added = 0;
  let updated = 0;
  let tasksAdded = 0;
  let tasksUpdated = 0;

  const tiers = ['easy', 'medium', 'hard', 'elite'] as const;

  await db.transaction(async (tx) => {
    for (const diary of diaries) {
      const regionName = formatDiaryRegionName(diary.name);
      const diaryId = normalizeDiaryRegion(regionName);
      const diaryName = `${regionName} Diary`;
      const wikiUrl = buildWikiUrl(diaryName);

      const existing = await tx.query.diaryDefinitions.findFirst({
        where: (d, { eq }) => eq(d.id, diaryId),
      });

      if (existing) {
        await tx
          .update(diaryDefinitions)
          .set({
            name: diaryName,
            region: regionName,
            wikiUrl: wikiUrl ?? null,
            updatedAt: new Date(),
          })
          .where(eq(diaryDefinitions.id, diaryId));
        updated++;
      } else {
        await tx.insert(diaryDefinitions).values({
          id: diaryId,
          name: diaryName,
          region: regionName,
          wikiUrl: wikiUrl ?? null,
        });
        added++;
      }

      for (const tierKey of tiers) {
        const skillRequirements = diary.requirements[tierKey] ?? [];
        const questRequirements = diary.questRequirements?.[tierKey] ?? [];
        const additionalRequirements =
          diary.additionalRequirements?.[tierKey] ?? [];

        const requirements = dedupeRequirements([
          ...skillRequirements
            .map((req) => toSkillRequirement(req))
            .filter((req): req is Requirement => Boolean(req)),
          ...questRequirements
            .map((questName) => {
              const questId = normalizeQuestName(questName);
              if (!questId || !knownQuestIds.has(questId)) {
                return {
                  type: 'manual-check',
                  label: `Quest: ${questName}`,
                } satisfies Requirement;
              }
              return {
                type: 'quest-complete',
                questId,
              } satisfies Requirement;
            }),
          ...additionalRequirements
            .map((requirement) => requirement.trim())
            .filter((label) => Boolean(label) && !/^[-\u2013\u2014]+$/.test(label))
            .map(
              (label) =>
                ({
                  type: 'manual-check',
                  label,
                }) satisfies Requirement
            ),
        ]);

        let tierRow = await tx.query.diaryTierDefinitions.findFirst({
          where: (t, { and, eq }) =>
            and(eq(t.diaryId, diaryId), eq(t.tier, tierKey)),
        });

        const tierName =
          tierKey.charAt(0).toUpperCase() + tierKey.slice(1);

        if (tierRow) {
          await tx
            .update(diaryTierDefinitions)
            .set({
              name: tierName,
              requirements,
              optionalRequirements: null,
              wikiUrl: null,
              updatedAt: new Date(),
            })
            .where(eq(diaryTierDefinitions.id, tierRow.id));
        } else {
          [tierRow] = await tx
            .insert(diaryTierDefinitions)
            .values({
              diaryId,
              tier: tierKey,
              name: tierName,
              requirements,
              optionalRequirements: null,
              wikiUrl: null,
            })
            .returning();
        }

        if (!tierRow) continue;

        const existingTasks = await tx.query.diaryTaskDefinitions.findMany({
          where: (t, { eq }) => eq(t.tierId, tierRow.id),
        });

        const byOrder = new Map(
          existingTasks.map((task) => [task.taskOrder, task])
        );

        const usedTaskIds = new Set<string>();

        for (const [index, task] of (diary.tasks[tierKey] ?? []).entries()) {
          const taskId = slugifyDiaryTask(task.description, usedTaskIds, index);
          const parsed = parseWikitextRequirements(task.requirements, {
            knownQuestIds,
            itemMap,
          });
          const taskRequirements = dedupeRequirements([
            ...parsed.requirements,
            ...parsed.manual,
          ]);
          const existingTask = byOrder.get(index);

          if (existingTask) {
            await tx
              .update(diaryTaskDefinitions)
              .set({
                taskId,
                description: task.description,
                requirements: taskRequirements,
                optionalRequirements: null,
                wikiUrl: wikiUrl ?? null,
                updatedAt: new Date(),
              })
              .where(eq(diaryTaskDefinitions.id, existingTask.id));
            tasksUpdated++;
          } else {
            await tx.insert(diaryTaskDefinitions).values({
              tierId: tierRow.id,
              taskId,
              taskOrder: index,
              description: task.description,
              requirements: taskRequirements,
              optionalRequirements: null,
              wikiUrl: wikiUrl ?? null,
            });
            tasksAdded++;
          }
        }
      }
    }
  });

  logger.info(
    { added, updated, tasksAdded, tasksUpdated },
    'Diary sync complete'
  );

  return { added, updated, tasksAdded, tasksUpdated };
}

/**
 * Sync all content from wiki
 */
export async function syncAllFromWiki(db: DbClient): Promise<{
  combatAchievements: { added: number; updated: number; total: number };
  quests: { added: number; updated: number; total: number };
  diaries: {
    added: number;
    updated: number;
    tasksAdded: number;
    tasksUpdated: number;
  };
}> {
  logger.info('Starting full wiki sync...');

  const combatAchievements = await syncCombatAchievements(db);
  const quests = await syncQuests(db);
  const diaries = await syncDiaries(db);

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
    diaries,
  };
}

const skillLookup = new Map<string, SkillName>(
  SKILLS.map((skill) => [skill.toLowerCase(), skill])
);

let cachedItemMap: Map<string, number> | null = null;
let cachedItemMapAt = 0;
const ITEM_MAP_TTL_MS = 10 * 60 * 1000;

function getUserAgent(): string {
  return (
    process.env['SKILLBOUND_USER_AGENT'] ??
    process.env['INTEGRATIONS_USER_AGENT'] ??
    'Skillbound/1.0'
  );
}

async function buildItemNameMap(userAgent: string): Promise<Map<string, number>> {
  const now = Date.now();
  if (cachedItemMap && now - cachedItemMapAt < ITEM_MAP_TTL_MS) {
    return cachedItemMap;
  }

  try {
    const client = createWikiPricesClient(userAgent);
    const mappings = await client.getItemMappings();
    const map = new Map<string, number>();
    for (const item of mappings) {
      map.set(normalizeItemName(item.name), item.id);
    }
    cachedItemMap = map;
    cachedItemMapAt = now;
    return map;
  } catch (error) {
    if (cachedItemMap) {
      return cachedItemMap;
    }
    logger.warn(
      { err: error },
      'Failed to load item mappings; item checks will be manual only.'
    );
    return new Map<string, number>();
  }
}

function parseQuestDetails(
  page: WikiPage | undefined
): { recommended?: string; questPoints?: number } {
  if (!page) return {};
  const details = parseInfobox(page.wikitext, 'Quest details', {
    clean: false,
  });
  const rewards = parseInfobox(page.wikitext, 'Quest rewards', {
    clean: false,
  });
  if (!details && !rewards) return {};

  const recommended = details?.params['recommended']?.trim();
  const qpRaw =
    details?.params['qp'] ??
    details?.params['quest points'] ??
    details?.params['questpoints'] ??
    rewards?.params['qp'] ??
    rewards?.params['quest points'] ??
    rewards?.params['questpoints'];
  const questPoints = parseQuestPoints(qpRaw);

  return {
    ...(recommended ? { recommended } : {}),
    ...(questPoints !== undefined ? { questPoints } : {}),
  };
}

function parseQuestPoints(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const match = raw.match(/\d+/);
  if (!match) return undefined;
  const value = Number(match[0]);
  if (!Number.isFinite(value)) return undefined;
  return value;
}

function formatDiaryRegionName(name: string): string {
  return name.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeDiaryRegion(regionName: string): string {
  return regionName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function slugifyDiaryTask(
  description: string,
  usedIds: Set<string>,
  index: number
): string {
  const base = description
    .toLowerCase()
    .replace(/['\u2019]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  let slug = base || `task_${index + 1}`;

  if (usedIds.has(slug)) {
    let suffix = 2;
    while (usedIds.has(`${slug}_${suffix}`)) {
      suffix += 1;
    }
    slug = `${slug}_${suffix}`;
  }

  usedIds.add(slug);
  return slug;
}

function toSkillRequirement(input: {
  skill: string;
  level: number;
}): Requirement | null {
  const normalized = input.skill.toLowerCase();
  if (normalized === 'combat' || normalized === 'combat level') {
    return { type: 'combat-level', level: input.level };
  }
  if (normalized === 'quest' || normalized === 'quest points') {
    return {
      type: 'activity-score',
      activityKey: 'quest_points',
      score: input.level,
    };
  }

  const skill = skillLookup.get(normalized);
  if (!skill) {
    return null;
  }

  return {
    type: 'skill-level',
    skill,
    level: input.level,
  };
}

function dedupeRequirements(requirements: Requirement[]): Requirement[] {
  const seen = new Set<string>();
  const unique: Requirement[] = [];

  for (const requirement of requirements) {
    const key = JSON.stringify(requirement);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(requirement);
  }

  return unique;
}
