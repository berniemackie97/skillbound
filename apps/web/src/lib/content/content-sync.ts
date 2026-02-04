import {
  type CharacterSnapshot,
  combatAchievementDefinitions,
  type DbClient,
  diaryDefinitions,
  diaryTaskDefinitions,
  diaryTierDefinitions,
  questDefinitions,
} from '@skillbound/database';

/**
 * Normalize quest name from RuneLite to our ID format
 */
function normalizeQuestName(questName: string): string {
  return questName
    .toLowerCase()
    .replace(/[''']/g, '_') // Convert all apostrophe types to underscore
    .replace(/…/g, '') // Remove ellipsis characters
    .replace(/[^a-z0-9_]+/g, '_') // Replace non-alphanumeric with underscore
    .replace(/_+/g, '_') // Collapse multiple underscores
    .replace(/^_+|_+$/g, ''); // Trim underscores
}

/**
 * Normalize diary region name
 */
function normalizeDiaryRegion(regionName: string): string {
  return regionName
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Update content definitions from RuneLite snapshot
 * This keeps our database in sync as users sync their characters
 */
export async function updateContentDefinitionsFromSnapshot(
  db: DbClient,
  snapshot: CharacterSnapshot
): Promise<{
  questsAdded: number;
  diariesAdded: number;
  tasksAdded: number;
}> {
  // Use transaction to ensure atomic content updates
  return await db.transaction(async (tx) => {
    let questsAdded = 0;
    let diariesAdded = 0;
    let tasksAdded = 0;

    // 1. Update quest definitions
    if (snapshot.quests && typeof snapshot.quests === 'object') {
      const questNames = Object.keys(
        snapshot.quests as Record<string, unknown>
      );

      for (const questName of questNames) {
        const questId = normalizeQuestName(questName);

        // Check if quest exists
        const existing = await tx.query.questDefinitions.findFirst({
          where: (quests, { eq }) => eq(quests.id, questId),
        });

        if (!existing) {
          // Add new quest
          await tx.insert(questDefinitions).values({
            id: questId,
            name: questName,
            requirements: [],
          });
          questsAdded++;
        }
      }
    }

    // 2. Update diary definitions and tasks
    if (
      snapshot.achievementDiaries &&
      typeof snapshot.achievementDiaries === 'object'
    ) {
      const diaries = snapshot.achievementDiaries as Record<
        string,
        Record<string, { complete?: boolean; tasks?: boolean[] }>
      >;

      for (const [regionName, tiers] of Object.entries(diaries)) {
        const diaryId = normalizeDiaryRegion(regionName);

        // Check if diary exists
        let diary = await tx.query.diaryDefinitions.findFirst({
          where: (d, { eq }) => eq(d.id, diaryId),
        });

        if (!diary) {
          // Add new diary
          [diary] = await tx
            .insert(diaryDefinitions)
            .values({
              id: diaryId,
              name: `${regionName} Diary`,
              region: regionName,
            })
            .returning();
          diariesAdded++;
        }

        // Process each tier
        for (const [tierName, tierData] of Object.entries(tiers)) {
          const tierLower = tierName.toLowerCase();

          // Check if tier exists
          let tier = await tx.query.diaryTierDefinitions.findFirst({
            where: (t, { and, eq }) =>
              and(eq(t.diaryId, diaryId), eq(t.tier, tierLower)),
          });

          if (!tier) {
            // Add new tier
            [tier] = await tx
              .insert(diaryTierDefinitions)
              .values({
                diaryId,
                tier: tierLower,
                name: tierName,
                requirements: [],
              })
              .returning();
          }

          // Process tasks
          if (tierData.tasks && Array.isArray(tierData.tasks) && tier) {
            const existingTasks = await tx.query.diaryTaskDefinitions.findMany({
              where: (t, { eq }) => eq(t.tierId, tier.id),
            });

            const existingCount = existingTasks.length;
            const runeliteCount = tierData.tasks.length;

            // Add missing tasks as placeholders
            if (runeliteCount > existingCount) {
              const tasksToAdd = [];
              for (let i = existingCount; i < runeliteCount; i++) {
                tasksToAdd.push({
                  tierId: tier.id,
                  taskId: `task_${i + 1}`,
                  taskOrder: i,
                  description: `${regionName} ${tierName} Task ${i + 1}`,
                  requirements: [],
                });
              }

              if (tasksToAdd.length > 0) {
                await tx.insert(diaryTaskDefinitions).values(tasksToAdd);
                tasksAdded += tasksToAdd.length;
              }
            }
          }
        }
      }
    }

    // 3. Update combat achievement definitions (if we have data)
    if (
      snapshot.combatAchievements &&
      Array.isArray(snapshot.combatAchievements)
    ) {
      const achievementIds = snapshot.combatAchievements;

      for (const runeliteId of achievementIds) {
        // Check if exists
        const existing = await tx.query.combatAchievementDefinitions.findFirst({
          where: (ca, { eq }) => eq(ca.runeliteId, runeliteId),
        });

        if (!existing) {
          // Add placeholder
          await tx.insert(combatAchievementDefinitions).values({
            id: `combat_achievement_${runeliteId}`,
            runeliteId,
            name: `Combat Achievement ${runeliteId}`,
            requirements: [],
          });
          // Note: We don't count these as they need proper wiki sync
        }
      }
    }

    return { questsAdded, diariesAdded, tasksAdded };
  });
}
