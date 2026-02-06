import type { GuideStepSeed } from '@skillbound/content';
import type {
  GuideInstruction,
  GuideStep,
  GuideStepMeta,
} from '@skillbound/database';
import type { CharacterFacts } from '@skillbound/domain';

import type {
  GuideChapterView,
  GuideSectionView,
} from '@/components/guides/guide-step-list';

import { evaluateGuideStepRequirements } from './guide-requirements';

type GuideStepLike = GuideStep | GuideStepSeed;
type GuideStepMetaLike = GuideStepLike['meta'];
type StatRequirementLike = {
  skill: string;
  level: number;
  icon?: string | undefined;
  note?: string | undefined;
};

type StatsNeededLike = {
  skill: string;
  level: number;
  note?: string | undefined;
};

function normalizeInstructions(
  instructions: GuideStepLike['instructions']
): GuideInstruction[] {
  return instructions.map((instruction) => ({
    text: instruction.text,
    ...(instruction.imageUrl ? { imageUrl: instruction.imageUrl } : {}),
    ...(instruction.imageAlt ? { imageAlt: instruction.imageAlt } : {}),
    ...(instruction.imageLink ? { imageLink: instruction.imageLink } : {}),
    ...(instruction.note ? { note: instruction.note } : {}),
  }));
}

function normalizeMeta(meta: GuideStepMetaLike): GuideStepMeta | undefined {
  if (!meta) {
    return undefined;
  }

  const itemsNeeded = (meta.itemsNeeded ?? []).map((item) => ({
    name: item.name,
    qty: item.qty,
    ...(item.consumed !== undefined ? { consumed: item.consumed } : {}),
    ...(item.note ? { note: item.note } : {}),
    ...(item.icon ? { icon: item.icon } : {}),
  }));

  const alternativeRoutes = (meta.alternativeRoutes ?? []).map((route) => ({
    text: route.text,
    ...(route.title ? { title: route.title } : {}),
  }));

  const gpStack = meta.gpStack
    ? {
        ...(meta.gpStack.note ? { note: meta.gpStack.note } : {}),
        ...(meta.gpStack.min !== undefined ? { min: meta.gpStack.min } : {}),
        ...(meta.gpStack.max !== undefined ? { max: meta.gpStack.max } : {}),
      }
    : undefined;

  const stats = meta.stats
    ? {
        required: (meta.stats.required ?? []).map((stat) =>
          normalizeStatRequirement(stat)
        ),
        after: (meta.stats.after ?? []).map((stat) =>
          normalizeStatRequirement(stat)
        ),
        ...(meta.stats.recommended
          ? {
              recommended: meta.stats.recommended.map(normalizeStatRequirement),
            }
          : {}),
      }
    : undefined;

  const statsNeeded =
    'statsNeeded' in meta && meta.statsNeeded
      ? meta.statsNeeded.map((stat: StatsNeededLike) => ({
          skill: stat.skill,
          level: stat.level,
          ...(stat.note ? { note: stat.note } : {}),
        }))
      : undefined;

  return {
    ...(gpStack ? { gpStack } : {}),
    ...(stats ? { stats } : {}),
    ...(statsNeeded ? { statsNeeded } : {}),
    itemsNeeded,
    alternativeRoutes,
  };
}

function normalizeStatRequirement(stat: StatRequirementLike) {
  return {
    skill: stat.skill,
    level: stat.level,
    ...(stat.icon ? { icon: stat.icon } : {}),
    ...(stat.note ? { note: stat.note } : {}),
  };
}

export function buildGuideChapters(
  steps: GuideStepLike[],
  facts: CharacterFacts | null
): GuideChapterView[] {
  const chapters: GuideChapterView[] = [];
  const chapterMap = new Map<string, GuideChapterView>();
  const sectionMap = new Map<string, GuideSectionView>();

  for (const step of steps) {
    const evaluation = evaluateGuideStepRequirements(step, facts);
    const section = step.section ?? null;
    const chapterTitle = section?.chapterTitle?.trim() || 'Guide steps';
    const sectionId = section?.id ?? 'ungrouped';
    const sectionKey = `${chapterTitle}::${sectionId}`;

    let chapter = chapterMap.get(chapterTitle);
    if (!chapter) {
      chapter = { title: chapterTitle, sections: [] };
      chapterMap.set(chapterTitle, chapter);
      chapters.push(chapter);
    }

    let sectionView = sectionMap.get(sectionKey);
    if (!sectionView) {
      sectionView = {
        id: sectionId,
        title: section?.title ?? 'Ungrouped steps',
        description: section?.description ?? '',
        chapterTitle,
        steps: [],
      };
      sectionMap.set(sectionKey, sectionView);
      chapter.sections.push(sectionView);
    }

    const instructions =
      step.instructions && step.instructions.length > 0
        ? normalizeInstructions(step.instructions)
        : undefined;

    const meta = normalizeMeta(step.meta);

    sectionView.steps.push({
      stepNumber: step.stepNumber,
      title: step.title,
      ...(instructions ? { instructions } : {}),
      status: evaluation.status,
      required: evaluation.required,
      optional: evaluation.optional,
      ...(meta ? { meta } : {}),
    });
  }

  return chapters;
}
