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
      description: 'Quests, diaries, and combat goals together in one view.',
      cards: [
        {
          title: 'Quest tracker',
          description: `Track ${counts.questCount} quests with clear requirements and next steps.`,
          cta: { label: 'View quests', href: '/progression?tab=quests' },
        },
        {
          title: 'Achievement diaries',
          description: `See ${counts.diaryCount} diary regions, tiers, and remaining tasks at a glance.`,
          cta: {
            label: 'View diaries',
            href: '/progression?tab=achievements&req=diaries',
          },
        },
        {
          title: 'Combat achievements',
          description: `Track ${counts.combatAchievementCount} tasks and plan bossing goals by tier.`,
          cta: {
            label: 'View combat achievements',
            href: '/progression?tab=achievements&req=combat',
          },
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
          cta: { label: 'View trades', href: '/trading' },
        },
        {
          title: 'Watch list',
          description: 'Pin items and monitor prices without re-searching.',
          cta: { label: 'Manage watch list', href: '/trading' },
        },
      ],
    },
    {
      title: 'Compare & analyze',
      description: 'See how you stack up and track gains over time.',
      cards: [
        {
          title: 'Character lookup',
          description:
            'Pull stats, quest points, and activity scores for any account.',
          cta: { label: 'Look up a character', href: '/lookup' },
        },
        {
          title: 'Compare accounts',
          description: 'Compare skills and progress side-by-side.',
          cta: { label: 'Compare characters', href: '/compare' },
        },
        {
          title: 'Snapshot history',
          description:
            'Automatic snapshots for XP, levels, and activity trends.',
          cta: { label: 'View snapshots', href: '/snapshots' },
        },
      ],
    },
  ];
}
