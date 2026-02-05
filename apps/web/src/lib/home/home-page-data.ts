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
      description:
        'Everything you need to track quests, diaries, and combat achievements in one place.',
      cards: [
        {
          title: 'Quest tracker',
          description: `Track ${counts.questCount} quests with full requirement breakdowns. See which quests you can start, what skills you need, and plan your path to Quest Cape.`,
          cta: { label: 'View quests', href: '/progression?tab=quests' },
        },
        {
          title: 'Achievement diaries',
          description: `Monitor progress across all ${counts.diaryCount} diary regions and tiers. Track task completion and see exactly what's left for your diary cape.`,
          cta: {
            label: 'View diaries',
            href: '/progression?tab=achievements&req=diaries',
          },
        },
        {
          title: 'Combat achievements',
          description: `Track ${counts.combatAchievementCount} combat achievement tasks across all tiers. Plan your bossing goals and monitor your progress.`,
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
          description:
            'Search any item to see current GE prices, historical trends, and price charts. Make informed decisions before buying or selling.',
          cta: { label: 'Browse exchange', href: '/trading' },
        },
        {
          title: 'Trade journal',
          description:
            'Log your trades and track profit over time. Perfect for flippers and anyone wanting to understand their gold flow.',
          cta: { label: 'View trades', href: '/trading' },
        },
        {
          title: 'Watch list',
          description:
            "Keep an eye on items you're interested in. Get a quick overview of prices for your favorite items without searching each time.",
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
            'Look up any OSRS character to see their stats, quest points, and activity scores. Works with mains, ironmen, and all account types.',
          cta: { label: 'Look up a character', href: '/lookup' },
        },
        {
          title: 'Compare accounts',
          description:
            "Compare two or more accounts side-by-side. See who's ahead in each skill and track your progress against friends or alts.",
          cta: { label: 'Compare characters', href: '/compare' },
        },
        {
          title: 'Snapshot history',
          description:
            'Track your gains over time with automatic snapshots. See XP gained, levels earned, and activities completed day by day.',
          cta: { label: 'View snapshots', href: '/snapshots' },
        },
      ],
    },
  ];
}
