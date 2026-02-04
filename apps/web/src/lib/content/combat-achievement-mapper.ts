import {
  combatAchievementDefinitions,
  inArray,
  type DbClient,
} from '@skillbound/database';

import { syncCombatAchievements } from '../wiki/wiki-sync';

export async function mapCombatAchievementsToContentIds(
  db: DbClient,
  runeliteIds: number[]
): Promise<Record<string, boolean>> {
  if (!runeliteIds || runeliteIds.length === 0) {
    return {};
  }

  let definitions = await db
    .select({
      runeliteId: combatAchievementDefinitions.runeliteId,
      name: combatAchievementDefinitions.name,
      monster: combatAchievementDefinitions.monster,
    })
    .from(combatAchievementDefinitions)
    .where(inArray(combatAchievementDefinitions.runeliteId, runeliteIds));

  if (definitions.length === 0) {
    try {
      await syncCombatAchievements(db);
      definitions = await db
        .select({
          runeliteId: combatAchievementDefinitions.runeliteId,
          name: combatAchievementDefinitions.name,
          monster: combatAchievementDefinitions.monster,
        })
        .from(combatAchievementDefinitions)
        .where(inArray(combatAchievementDefinitions.runeliteId, runeliteIds));
    } catch (_error) {
      // If sync fails, fall back to empty mapping to avoid failing the request.
      return {};
    }
  }

  const mapped: Record<string, boolean> = {};

  for (const definition of definitions) {
    if (!definition.runeliteId || !definition.name) {
      continue;
    }
    const display = [definition.monster, definition.name]
      .filter(Boolean)
      .join(' ');
    const contentId = slugifyKey(display);
    if (contentId) {
      mapped[contentId] = true;
    }
  }

  return mapped;
}

function slugifyKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}
