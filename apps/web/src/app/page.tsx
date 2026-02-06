import { HomeFeatureGrid } from '@/components/home/home-feature-grid';
import { HomeHero } from '@/components/home/home-hero';
import { HomeSection } from '@/components/home/home-section';
import { getLatestContentBundle } from '@/lib/content/content-bundles';
import { buildHomeCounts, buildHomeSections } from '@/lib/home/home-page-data';
import { buildPageMetadata } from '@/lib/seo/metadata';

export const metadata = buildPageMetadata({
  title: 'Free OSRS Progression Tracker & GE Tools',
  description:
    'Track Old School RuneScape progression, ironman milestones, quests, diaries, and GE profits. Free OSRS tracker with guides and calculators.',
  canonicalPath: '/',
});

export default async function HomePage() {
  const bundle = await getLatestContentBundle();

  const counts = buildHomeCounts(bundle);
  const sections = buildHomeSections(counts);

  return (
    <>
      <HomeHero counts={counts} />
      <HomeFeatureGrid />
      {sections.map((section) => (
        <HomeSection
          key={section.title}
          cards={section.cards}
          description={section.description}
          title={section.title}
        />
      ))}
    </>
  );
}
