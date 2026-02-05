import { createHash } from 'crypto';

import type { CombatAchievement, ContentBundle } from '@skillbound/content';
import type { DbClient } from '@skillbound/database';
import type { Requirement } from '@skillbound/domain';

/**
 * Generate a content bundle from database
 * This creates the JSON structure that the app expects
 */
export async function generateContentBundle(
  db: DbClient
): Promise<ContentBundle> {
  // Load all quests
  const questDefs = await db.query.questDefinitions.findMany();

  // Load all diaries with tiers and tasks
  const diaryDefs = await db.query.diaryDefinitions.findMany({
    with: {
      tiers: {
        with: {
          tasks: true,
        },
      },
    },
  });

  // Load all combat achievements
  const combatAchievementDefs =
    await db.query.combatAchievementDefinitions.findMany();

  // Transform database records to bundle format
  const quests = questDefs.map((q) => ({
    id: q.id,
    name: q.name,
    difficulty: q.difficulty || undefined,
    length: q.length || undefined,
    description: q.description || undefined,
    questPoints: q.questPoints ?? undefined,
    requirements: (q.requirements as Requirement[]) || [],
    optionalRequirements:
      (q.optionalRequirements as Requirement[] | undefined) || undefined,
    wikiUrl: q.wikiUrl || undefined,
  }));

  const diaries = diaryDefs.map((d) => ({
    id: d.id,
    name: d.name,
    region: d.region,
    wikiUrl: d.wikiUrl || undefined,
    tiers: (d.tiers || [])
      .sort((a, b) => {
        const tierOrder = ['easy', 'medium', 'hard', 'elite'];
        return tierOrder.indexOf(a.tier) - tierOrder.indexOf(b.tier);
      })
      .map((t) => ({
        tier: t.tier,
        name: t.name || undefined,
        requirements: (t.requirements as Requirement[]) || [],
        optionalRequirements:
          (t.optionalRequirements as Requirement[] | undefined) || undefined,
        tasks: (t.tasks || [])
          .sort((a, b) => a.taskOrder - b.taskOrder)
          .map((task) => ({
            id: task.taskId,
            description: task.description,
            requirements: (task.requirements as Requirement[]) || [],
            optionalRequirements:
              (task.optionalRequirements as Requirement[] | undefined) ||
              undefined,
            wikiUrl: task.wikiUrl || undefined,
          })),
      })),
  }));

  const combatAchievements = combatAchievementDefs.map((ca) => {
    const slug = slugifyCombatAchievement(ca.monster, ca.name);
    const id = slug || ca.id;

    return {
      id,
      runeliteId: ca.runeliteId ?? undefined,
      name: ca.name,
      monster: ca.monster ?? undefined,
      description: ca.description || ca.name, // Use actual task description from wiki
      tier:
        (ca.tier as
          | 'Easy'
          | 'Medium'
          | 'Hard'
          | 'Elite'
          | 'Master'
          | 'Grandmaster') || 'Easy',
      points: 0, // TODO: Add points field to schema
      requirements: (ca.requirements as Requirement[]) || [],
      optionalRequirements:
        (ca.optionalRequirements as Requirement[] | undefined) || undefined,
      wikiUrl: ca.wikiUrl || undefined,
    } satisfies CombatAchievement;
  });

  // Generate bundle
  const bundle: ContentBundle = {
    metadata: {
      version: new Date().toISOString().split('T')[0] || 'unknown',
      publishedAt: new Date().toISOString(),
      sources: ['database', 'runelite-sync'],
      checksum: '', // Will be calculated below
      questCount: quests.length,
      diaryCount: diaries.length,
    },
    quests,
    diaries,
    combatAchievements,
  };

  // Calculate checksum
  const bundleJson = JSON.stringify(bundle, null, 2);
  const checksum = createHash('sha256').update(bundleJson).digest('hex');
  bundle.metadata.checksum = checksum;

  return bundle;
}

function slugifyCombatAchievement(
  monster: string | null,
  name: string
): string {
  const display = [monster, name].filter(Boolean).join(' ');
  if (!display) return '';
  return display
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Save bundle to database content_bundles table
 */
export async function saveBundleRecord(
  db: DbClient,
  bundle: ContentBundle,
  storageUri: string
): Promise<void> {
  const { contentBundles } = await import('@skillbound/database');

  // Use upsert (on conflict update) to handle duplicate versions
  await db
    .insert(contentBundles)
    .values({
      version: bundle.metadata.version,
      status: 'published',
      checksum: bundle.metadata.checksum,
      storageUri,
      metadata: {
        sources: bundle.metadata.sources,
        generatedAt: bundle.metadata.publishedAt,
        questCount: bundle.metadata.questCount ?? 0,
        diaryCount: bundle.metadata.diaryCount ?? 0,
      },
      publishedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: contentBundles.version,
      set: {
        checksum: bundle.metadata.checksum,
        storageUri,
        metadata: {
          sources: bundle.metadata.sources,
          generatedAt: bundle.metadata.publishedAt,
          questCount: bundle.metadata.questCount ?? 0,
          diaryCount: bundle.metadata.diaryCount ?? 0,
        },
        publishedAt: new Date(),
      },
    });
}
