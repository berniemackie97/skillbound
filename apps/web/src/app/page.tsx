import { getLatestContentBundle } from '@/lib/content/content-bundles';
import { HomeHero } from '@/components/home/home-hero';
import { HomeSection } from '@/components/home/home-section';
import { HomeFeatureGrid } from '@/components/home/home-feature-grid';
import { buildHomeCounts, buildHomeSections } from '@/lib/home/home-page-data';

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
          title={section.title}
          description={section.description}
          cards={section.cards}
        />
      ))}
    </>
  );
}