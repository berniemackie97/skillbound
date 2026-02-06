import {
  guideTemplates as seedGuides,
  type GuideRequirementSeed,
  type GuideStepSeed,
  type GuideTemplateSeed,
} from '@skillbound/content';
import {
  and,
  eq,
  guideTemplates,
  type GuideInstruction,
  type GuideRequirement,
  type GuideSection,
  type GuideStatRequirement,
  type GuideStep,
  type GuideTemplate,
  type NewGuideTemplate,
  type GuideStepMeta,
} from '@skillbound/database';

import { getDbClient } from '../db';

import { getGuideTemplateFromCatalog } from './guide-catalog';

type GuideSeedKey = string;

function getGuideSeedKey(seed: Pick<NewGuideTemplate, 'title' | 'version'>) {
  return `${seed.title}::${seed.version}`;
}

function normalizeRequirement(
  requirement: GuideRequirementSeed
): GuideRequirement {
  const normalized: GuideRequirement = {
    type: requirement.type,
    data: requirement.data,
  };

  if (requirement.optional === true) {
    normalized.optional = true;
  }

  return normalized;
}

function normalizeStatRequirement(
  stat: NonNullable<
    NonNullable<GuideStepSeed['meta']>['stats']
  >['required'][number]
): GuideStatRequirement {
  const normalized: GuideStatRequirement = {
    skill: stat.skill,
    level: stat.level,
  };

  if (stat.icon !== undefined) {
    normalized.icon = stat.icon;
  }

  if (stat.note !== undefined) {
    normalized.note = stat.note;
  }

  return normalized;
}

function normalizeMeta(
  stepMeta: NonNullable<GuideStepSeed['meta']>
): GuideStepMeta {
  const gpStack =
    stepMeta.gpStack === undefined
      ? undefined
      : {
          ...(stepMeta.gpStack.note === undefined
            ? {}
            : { note: stepMeta.gpStack.note }),
          ...(stepMeta.gpStack.min === undefined
            ? {}
            : { min: stepMeta.gpStack.min }),
          ...(stepMeta.gpStack.max === undefined
            ? {}
            : { max: stepMeta.gpStack.max }),
        };

  const itemsNeeded = (stepMeta.itemsNeeded ?? []).map((i) => ({
    name: i.name,
    qty: i.qty,
    ...(i.consumed === undefined ? {} : { consumed: i.consumed }),
    ...(i.note === undefined ? {} : { note: i.note }),
    ...(i.icon === undefined ? {} : { icon: i.icon }),
  }));

  // Normalize the stats structure, mapping legacy "recommended" into "after".
  const stats = stepMeta.stats
    ? {
        required: (stepMeta.stats.required ?? []).map(normalizeStatRequirement),
        after: (stepMeta.stats.after ?? stepMeta.stats.recommended ?? []).map(
          normalizeStatRequirement
        ),
      }
    : undefined;

  const alternativeRoutes = (stepMeta.alternativeRoutes ?? []).map((a) => ({
    text: a.text,
    ...(a.title === undefined ? {} : { title: a.title }),
  }));

  return {
    ...(gpStack === undefined ? {} : { gpStack }),
    itemsNeeded,
    ...(stats === undefined ? {} : { stats }),
    alternativeRoutes,
  };
}

function normalizeInstruction(
  instruction: NonNullable<GuideStepSeed['instructions']>[number]
): GuideInstruction {
  const normalized: GuideInstruction = {
    text: instruction.text,
  };

  if (instruction.imageUrl !== undefined) {
    normalized.imageUrl = instruction.imageUrl;
  }

  if (instruction.imageAlt !== undefined) {
    normalized.imageAlt = instruction.imageAlt;
  }

  if (instruction.imageLink !== undefined) {
    normalized.imageLink = instruction.imageLink;
  }

  if (instruction.note !== undefined) {
    normalized.note = instruction.note;
  }

  return normalized;
}

function normalizeStep(step: GuideStepSeed): GuideStep {
  const normalized: GuideStep = {
    stepNumber: step.stepNumber,
    title: step.title,
    instructions: step.instructions.map(normalizeInstruction),
    requirements: step.requirements.map(normalizeRequirement),
  };

  if (step.optionalRequirements && step.optionalRequirements.length > 0) {
    normalized.optionalRequirements =
      step.optionalRequirements.map(normalizeRequirement);
  }

  if (step.wikiLinks && step.wikiLinks.length > 0) {
    normalized.wikiLinks = step.wikiLinks;
  }

  if (step.calculatorLinks && step.calculatorLinks.length > 0) {
    normalized.calculatorLinks = step.calculatorLinks;
  }

  if (step.tags && step.tags.length > 0) {
    normalized.tags = step.tags;
  }

  if (step.section) {
    const section: GuideSection = {
      id: step.section.id,
      title: step.section.title,
    };

    if (step.section.description !== undefined) {
      section.description = step.section.description;
    }

    if (step.section.chapterTitle !== undefined) {
      section.chapterTitle = step.section.chapterTitle;
    }

    normalized.section = section;
  }

  if (step.meta) {
    normalized.meta = normalizeMeta(step.meta);
  }

  return normalized;
}

function normalizeGuideTemplate(seed: GuideTemplateSeed): NewGuideTemplate {
  return {
    title: seed.title,
    description: seed.description,
    version: seed.version,
    status: seed.status,
    recommendedModes: seed.recommendedModes,
    tags: seed.tags,
    steps: seed.steps.map(normalizeStep),
  };
}

function buildSeedInsert(seed: NewGuideTemplate): NewGuideTemplate {
  const isPublished = seed.status === 'published';

  return {
    ...seed,
    recommendedModes: seed.recommendedModes ?? ['normal'],
    tags: seed.tags ?? [],
    publishedAt: isPublished ? new Date() : null,
  };
}

function seedNeedsUpdate(
  existing: GuideTemplate,
  seed: NewGuideTemplate
): boolean {
  return (
    existing.description !== seed.description ||
    existing.status !== seed.status ||
    JSON.stringify(existing.recommendedModes ?? []) !==
      JSON.stringify(seed.recommendedModes ?? ['normal']) ||
    JSON.stringify(existing.tags ?? []) !== JSON.stringify(seed.tags ?? []) ||
    JSON.stringify(existing.steps) !== JSON.stringify(seed.steps)
  );
}

export async function ensureGuideTemplates(): Promise<void> {
  const db = getDbClient();
  const existing = await db.select().from(guideTemplates);

  const normalizedSeeds = seedGuides.map(normalizeGuideTemplate);
  const existingMap = new Map<GuideSeedKey, GuideTemplate>();

  for (const template of existing) {
    existingMap.set(getGuideSeedKey(template), template);
  }

  const seedKeys = new Set(
    normalizedSeeds.map((seed) => getGuideSeedKey(seed))
  );
  const inserts: NewGuideTemplate[] = [];
  const updates: { id: string; seed: NewGuideTemplate }[] = [];

  for (const seed of normalizedSeeds) {
    const existingTemplate = existingMap.get(getGuideSeedKey(seed));

    if (!existingTemplate) {
      inserts.push(buildSeedInsert(seed));
      continue;
    }

    if (seedNeedsUpdate(existingTemplate, seed)) {
      updates.push({ id: existingTemplate.id, seed });
    }
  }

  if (inserts.length > 0) {
    await db.insert(guideTemplates).values(inserts);
  }

  for (const update of updates) {
    const status = update.seed.status ?? 'draft';
    const isPublished = status === 'published';

    await db
      .update(guideTemplates)
      .set({
        description: update.seed.description,
        status,
        recommendedModes: update.seed.recommendedModes ?? ['normal'],
        tags: update.seed.tags ?? [],
        steps: update.seed.steps,
        publishedAt:
          update.seed.publishedAt ?? (isPublished ? new Date() : null),
      })
      .where(eq(guideTemplates.id, update.id));
  }

  const deprecated: GuideTemplate[] = [];

  for (const template of existing) {
    const key = getGuideSeedKey(template);

    if (
      template.title.toLowerCase().includes('bruhsailer') &&
      !seedKeys.has(key) &&
      template.status !== 'deprecated'
    ) {
      deprecated.push(template);
    }
  }

  for (const template of deprecated) {
    await db
      .update(guideTemplates)
      .set({ status: 'deprecated' })
      .where(eq(guideTemplates.id, template.id));
  }
}

export async function getPublishedGuideTemplates(): Promise<GuideTemplate[]> {
  await ensureGuideTemplates();
  const db = getDbClient();

  return db
    .select()
    .from(guideTemplates)
    .where(eq(guideTemplates.status, 'published'));
}

export async function getGuideTemplateById(
  templateId: string
): Promise<GuideTemplate | null> {
  await ensureGuideTemplates();
  const db = getDbClient();

  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (uuidPattern.test(templateId)) {
    try {
      const [template] = await db
        .select()
        .from(guideTemplates)
        .where(eq(guideTemplates.id, templateId))
        .limit(1);

      return template ?? null;
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'cause' in error &&
        error.cause &&
        typeof error.cause === 'object' &&
        'code' in error.cause &&
        error.cause.code === '22P02'
      ) {
        // Invalid UUID from route params; fall back to catalog lookup.
      } else {
        throw error;
      }
    }
  }

  const catalogEntry = await getGuideTemplateFromCatalog(templateId);
  if (!catalogEntry) {
    return null;
  }

  const [template] = await db
    .select()
    .from(guideTemplates)
    .where(
      and(
        eq(guideTemplates.title, catalogEntry.title),
        eq(guideTemplates.version, catalogEntry.version)
      )
    )
    .limit(1);

  return template ?? null;
}
