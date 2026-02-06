import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { GuideDetailClient } from '@/components/guides/guide-detail-client';
import { getGuideTemplateFromCatalog } from '@/lib/guides/guide-catalog';
import { buildGuideChapters } from '@/lib/guides/guide-view';
import { buildPageMetadata } from '@/lib/seo/metadata';

type GuideDetailPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const resolvedParams = await params;
  const template = await getGuideTemplateFromCatalog(resolvedParams.id);
  if (!template) {
    return {
      title: 'Guide Not Found - SkillBound',
      robots: { index: false, follow: true },
    };
  }

  return buildPageMetadata({
    title: `${template.title} - OSRS Progression Guide`,
    description: template.description,
    canonicalPath: `/guides/${resolvedParams.id}`,
    openGraphType: 'article',
  });
}

export default async function GuideDetailPage({
  params,
}: GuideDetailPageProps) {
  const resolvedParams = await params;
  const template = await getGuideTemplateFromCatalog(resolvedParams.id);
  if (!template) {
    notFound();
  }

  const chapters = buildGuideChapters(template.steps, null);

  return <GuideDetailClient initialChapters={chapters} template={template} />;
}
