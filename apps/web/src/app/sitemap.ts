import type { MetadataRoute } from 'next';

import { getPublishedGuideTemplates } from '@/lib/guides/guide-templates';
import { resolveSiteOrigin } from '@/lib/seo/site-url';

type StaticRoute = {
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
  priority: number;
};

const STATIC_ROUTES: StaticRoute[] = [
  { path: '/', changeFrequency: 'weekly', priority: 1 },
  { path: '/progression', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/guides', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/trading', changeFrequency: 'daily', priority: 0.8 },
  { path: '/lookup', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/calculators', changeFrequency: 'weekly', priority: 0.7 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = resolveSiteOrigin() ?? 'http://localhost:3000';
  const now = new Date();

  const staticEntries = STATIC_ROUTES.map((route) => ({
    url: `${origin}${route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  let guideEntries: MetadataRoute.Sitemap = [];
  try {
    const guideTemplates = await getPublishedGuideTemplates();
    guideEntries = guideTemplates.map((template) => ({
      url: `${origin}/guides/${template.id}`,
      lastModified: template.publishedAt ?? now,
      changeFrequency: 'monthly',
      priority: 0.6,
    }));
  } catch {
    guideEntries = [];
  }

  return [...staticEntries, ...guideEntries];
}
