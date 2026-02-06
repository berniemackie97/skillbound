import {
  guideTemplates,
  type GuideTemplateBundle,
  type GuideTemplateSeed,
} from '@skillbound/content';

import { getLatestContentBundle } from '@/lib/content/content-bundles';

function slugifyGuideId(title: string) {
  return title
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildGuideSeedId(seed: GuideTemplateSeed) {
  const slug = slugifyGuideId(seed.title);
  return `${slug || 'guide'}-v${seed.version}`;
}

const seedGuides: GuideTemplateBundle[] = guideTemplates.map((guide) => ({
  id: buildGuideSeedId(guide),
  ...guide,
}));

function resolveBundleGuides(
  guides: GuideTemplateBundle[] | undefined
): GuideTemplateBundle[] {
  if (guides && guides.length > 0) {
    return guides;
  }
  return seedGuides;
}

export async function getPublishedGuideCatalog(): Promise<
  GuideTemplateBundle[]
> {
  const bundle = await getLatestContentBundle();
  return resolveBundleGuides(bundle.guides).filter(
    (guide) => guide.status === 'published'
  );
}

export async function getGuideTemplateFromCatalog(
  templateId: string
): Promise<GuideTemplateBundle | null> {
  const guides = await getPublishedGuideCatalog();
  return guides.find((guide) => guide.id === templateId) ?? null;
}
