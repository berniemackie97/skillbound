import { GuidesClient } from '@/components/guides/guides-client';
import { getPublishedGuideCatalog } from '@/lib/guides/guide-catalog';
import { buildPageMetadata } from '@/lib/seo/metadata';

export const metadata = buildPageMetadata({
  title: 'OSRS Progression Guides',
  description:
    'Curated Old School RuneScape progression guides with step-by-step checklists for ironman and main accounts.',
  canonicalPath: '/guides',
});

export const revalidate = 3600;

export default async function GuidesPage() {
  const templates = await getPublishedGuideCatalog();

  // Get unique tags for filtering
  const allTags = [...new Set(templates.flatMap((t) => t.tags ?? []))].sort();

  const guides = templates.map((template) => ({
    id: template.id,
    title: template.title,
    description: template.description,
    tags: template.tags ?? [],
    stepCount: template.steps.length,
    recommendedModes: template.recommendedModes ?? [],
    version: template.version,
  }));

  return (
    <div className="guides-page">
      <GuidesClient allTags={allTags} guides={guides} />
    </div>
  );
}
