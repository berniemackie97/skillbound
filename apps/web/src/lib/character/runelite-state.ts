import type { ParsedRuneLiteData } from '@skillbound/hiscores';

import { getLatestContentBundle } from '../content/content-bundles';

import { setStates, type BatchStateUpdate } from './character-state-service';
import { normalizeDiaryRegion, normalizeQuestName } from './runelite-facts';

type DiaryBundle = {
  id: string;
  tiers: Array<{ tier: string; tasks: Array<{ id: string }> }>;
};

type ContentBundle = {
  diaries: DiaryBundle[];
};

function toAchievedAt(
  completed: boolean,
  capturedAt: Date
): Date | undefined {
  return completed ? capturedAt : undefined;
}

function buildQuestUpdates(
  runelite: ParsedRuneLiteData,
  capturedAt: Date
): BatchStateUpdate[] {
  const updates: BatchStateUpdate[] = [];

  for (const [questName, status] of Object.entries(runelite.quests ?? {})) {
    const questId = normalizeQuestName(questName);
    const completed = status === 2;
    updates.push({
      domain: 'quest',
      key: questId,
      value: {
        status,
        completed,
        inProgress: status === 1,
      },
      options: {
        source: 'runelite',
        achievedAt: toAchievedAt(completed, capturedAt),
      },
    });
  }

  return updates;
}

function buildDiaryUpdates(
  runelite: ParsedRuneLiteData,
  bundle: ContentBundle | null,
  capturedAt: Date
): BatchStateUpdate[] {
  const updates: BatchStateUpdate[] = [];
  const diaries = runelite.achievement_diaries ?? {};

  for (const [regionName, region] of Object.entries(diaries)) {
    if (!region || typeof region !== 'object') {
      continue;
    }

    const regionId = normalizeDiaryRegion(regionName);
    const bundleDiary = bundle?.diaries?.find((entry) => entry.id === regionId);

    for (const [tierName, tierData] of Object.entries(
      region as unknown as Record<string, unknown>
    )) {
      const tierKey = `${regionId}:${tierName.toLowerCase()}`;
      const completed = Boolean((tierData as { complete?: boolean }).complete);

      updates.push({
        domain: 'diary',
        key: tierKey,
        value: { completed },
        options: {
          source: 'runelite',
          achievedAt: toAchievedAt(completed, capturedAt),
        },
      });

      const tasks = (tierData as { tasks?: boolean[] }).tasks ?? [];
      const bundleTier = bundleDiary?.tiers?.find(
        (entry) => entry.tier === tierName.toLowerCase()
      );

      tasks.forEach((taskComplete, index) => {
        const taskId = bundleTier?.tasks?.[index]?.id ?? `task${index + 1}`;
        const taskKey = `${tierKey}:${taskId}`;
        updates.push({
          domain: 'diary_task',
          key: taskKey,
          value: { completed: Boolean(taskComplete) },
          options: {
            source: 'runelite',
            achievedAt: toAchievedAt(Boolean(taskComplete), capturedAt),
          },
        });
      });
    }
  }

  return updates;
}

function buildCombatAchievementUpdates(
  runelite: ParsedRuneLiteData,
  capturedAt: Date
): BatchStateUpdate[] {
  const updates: BatchStateUpdate[] = [];

  for (const id of runelite.combat_achievements ?? []) {
    updates.push({
      domain: 'combat_achievement',
      key: String(id),
      value: { completed: true },
      options: {
        source: 'runelite',
        achievedAt: capturedAt,
      },
    });
  }

  return updates;
}

export async function syncCharacterStateFromRunelite(
  userCharacterId: string,
  runelite: ParsedRuneLiteData,
  capturedAtInput: Date
): Promise<number> {
  const capturedAt =
    capturedAtInput instanceof Date ? capturedAtInput : new Date(capturedAtInput);
  const bundle = (await getLatestContentBundle()) as ContentBundle;

  const updates: BatchStateUpdate[] = [
    ...buildQuestUpdates(runelite, capturedAt),
    ...buildDiaryUpdates(runelite, bundle ?? null, capturedAt),
    ...buildCombatAchievementUpdates(runelite, capturedAt),
  ];

  if (updates.length === 0) {
    return 0;
  }

  await setStates(userCharacterId, updates);
  return updates.length;
}

