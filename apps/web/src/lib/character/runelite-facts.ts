import type { CharacterSnapshot } from '@skillbound/database';
import type { CharacterFacts } from '@skillbound/domain';

/**
 * Normalize quest name to quest ID format to match content bundle
 * RuneLite: "Cook's Assistant" -> Content bundle: "cook_s_assistant"
 * RuneLite: "Black Knight's Fortress" -> Content bundle: "black_knight_s_fortress"
 *
 * The key is that apostrophes become underscores, preserving the 's'
 */
export function normalizeQuestName(questName: string): string {
  return questName
    .toLowerCase()
    .replace(/[''']/g, '_') // Convert all apostrophe types to underscore
    .replace(/…/g, '') // Remove ellipsis characters
    .replace(/[^a-z0-9_]+/g, '_') // Replace non-alphanumeric (keeping existing underscores) with underscore
    .replace(/_+/g, '_') // Collapse multiple consecutive underscores into one
    .replace(/^_+|_+$/g, ''); // Trim underscores from start and end
}

/**
 * Normalize diary region name to diary ID format
 * RuneLite returns region names like "Ardougne", "Karamja"
 * Content bundle uses IDs like "ardougne", "karamja"
 */
export function normalizeDiaryRegion(regionName: string): string {
  return regionName.toLowerCase().replace(/[^a-z0-9]+/g, '_');
}

/**
 * Convert RuneLite snapshot data to CharacterFacts
 * This includes quest completion, diary completion, and combat achievements
 *
 * @param contentBundle - The content bundle containing diary task definitions (needed to map task indices to IDs)
 */
export function enrichFactsWithRuneLiteData(
  facts: CharacterFacts,
  snapshot: CharacterSnapshot,
  contentBundle?: {
    diaries: Array<{
      id: string;
      tiers: Array<{ tier: string; tasks: Array<{ id: string }> }>;
    }>;
  }
): CharacterFacts {
  const enriched = { ...facts };

  // Add quest completion data from RuneLite
  // RuneLite quest status: 0 = not started, 1 = in progress, 2 = completed
  // RuneLite returns ALL quests, so we explicitly set all of them (no unknowns)
  if (snapshot.quests) {
    const questCompletions: Record<string, boolean> = {};
    for (const [questName, status] of Object.entries(snapshot.quests)) {
      const questId = normalizeQuestName(questName);
      // Status 2 means completed, 0 or 1 means not completed
      questCompletions[questId] = status === 2;
    }
    enriched.quests = questCompletions;
  }

  // Add diary completion data from RuneLite
  // RuneLite structure: { regionName: { Easy: { complete: boolean, tasks: boolean[] }, ... } }
  if (
    snapshot.achievementDiaries &&
    typeof snapshot.achievementDiaries === 'object'
  ) {
    const diaryCompletions: Record<string, boolean> = {};
    const diaryTaskCompletions: Record<string, boolean> = {};

    for (const [regionName, region] of Object.entries(
      snapshot.achievementDiaries
    )) {
      if (!region || typeof region !== 'object') continue;

      const regionId = normalizeDiaryRegion(regionName);

      // Each tier (Easy, Medium, Hard, Elite)
      for (const [tier, tierData] of Object.entries(
        region as Record<string, unknown>
      )) {
        const tierKey = `${regionId}:${tier.toLowerCase()}`;
        diaryCompletions[tierKey] =
          (tierData as { complete?: boolean }).complete ?? false;

        // Individual tasks - map RuneLite task indices to actual task IDs from content bundle
        const tasks = (tierData as { tasks?: boolean[] }).tasks ?? [];

        if (contentBundle) {
          // Find the diary in the content bundle
          const diary = contentBundle.diaries.find((d) => d.id === regionId);
          if (diary) {
            // Find the tier in the diary
            const diaryTier = diary.tiers.find(
              (t) => t.tier === tier.toLowerCase()
            );
            if (diaryTier) {
              // Map each task completion status to its actual task ID
              tasks.forEach((completed, index) => {
                const task = diaryTier.tasks[index];
                if (task) {
                  const taskKey = `${tierKey}:${task.id}`;
                  diaryTaskCompletions[taskKey] = completed;
                }
              });
            }
          }
        } else {
          // Fallback to generic task keys if no content bundle provided
          tasks.forEach((completed, index) => {
            const taskKey = `${tierKey}:task${index + 1}`;
            diaryTaskCompletions[taskKey] = completed;
          });
        }
      }
    }

    enriched.diaries = diaryCompletions;
    enriched.diaryTasks = diaryTaskCompletions;
  }

  // Add combat achievement completion data from RuneLite
  // RuneLite returns array of completed achievement IDs
  if (snapshot.combatAchievements) {
    const combatAchievementCompletions: Record<string, boolean> = {};
    for (const achievementId of snapshot.combatAchievements) {
      combatAchievementCompletions[String(achievementId)] = true;
    }
    enriched.combatAchievements = combatAchievementCompletions;
  }

  return enriched;
}
