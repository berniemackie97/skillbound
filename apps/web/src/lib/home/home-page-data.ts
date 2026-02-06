import type {
  BundleForHomeCounts,
  HomeCounts,
  HomeSectionModel,
} from '@/lib/home/home-types';

export function buildHomeCounts(bundle: BundleForHomeCounts): HomeCounts {
  return {
    version: bundle.metadata.version,
    questCount: bundle.metadata.questCount ?? bundle.quests.length,
    diaryCount: bundle.metadata.diaryCount ?? bundle.diaries.length,
    combatAchievementCount:
      bundle.metadata.combatAchievementCount ??
      bundle.combatAchievements.length,
  };
}

export function buildHomeSections(counts: HomeCounts): HomeSectionModel[] {
  return [
    {
      title: 'Track your journey',
      description: 'Quests, achievements, and guides together in one view.',
      cards: [
        {
          title: 'Quest tracker',
          description: `Track ${counts.questCount} quests with clear requirements and next steps.`,
          cta: { label: 'View quests', href: '/progression?tab=quests' },
        },
        {
          title: 'Achievement tracker',
          description: `Track ${counts.diaryCount} diary regions and ${counts.combatAchievementCount} combat tasks in one checklist.`,
          cta: {
            label: 'View achievements',
            href: '/progression?tab=achievements',
          },
        },
        {
          title: 'Guides & overlays',
          description:
            'Follow community guides with step-by-step requirements baked in.',
          cta: { label: 'Open guides', href: '/guides' },
        },
      ],
    },
    {
      title: 'Grand Exchange tools',
      description: 'Real-time prices and trade tracking for smarter decisions.',
      cards: [
        {
          title: 'Price lookup',
          description: 'Search items for current prices, trends, and charts.',
          cta: { label: 'Browse exchange', href: '/trading' },
        },
        {
          title: 'Trade journal',
          description: 'Log trades and see profit trends over time.',
          cta: {
            label: 'View trades',
            href: '/trading/tracker#trade-history',
          },
        },
        {
          title: 'Live alerts',
          description: 'Monitor inventory signals and watchlist thresholds.',
          cta: {
            label: 'View alerts',
            href: '/trading/tracker#live-alerts',
          },
        },
      ],
    },
  ];
}
