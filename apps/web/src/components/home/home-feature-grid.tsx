type HomeFeature = {
  title: string;
  description: string;
};

export const HOME_FEATURES: HomeFeature[] = [
  {
    title: 'Progression hub',
    description:
      'Track multiple characters, surface requirements, and plan next steps fast.',
  },
  {
    title: 'Trade & price tracking',
    description:
      'Live GE prices, margins, and trade history in one clean view.',
  },
  {
    title: 'Integrated with popular guides',
    description:
      'Follow community guides and keep steps synced to your character.',
  },
];

export function HomeFeatureGrid() {
  return (
    <section className="feature-grid home-feature-grid">
      {HOME_FEATURES.map((feature) => (
        <article key={feature.title} className="feature-card">
          <h3>{feature.title}</h3>
          <p>{feature.description}</p>
        </article>
      ))}
    </section>
  );
}
