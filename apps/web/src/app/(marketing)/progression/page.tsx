import { ProgressionPageClient } from '@/components/progression/progression-page-client';
import { buildPageMetadata } from '@/lib/seo/metadata';

type SearchParams = {
  username?: string | string[];
  mode?: string | string[];
};

type PageProps = {
  // Next.js may provide searchParams as either an object or a Promise depending on
  // route configuration and framework version. Handle both.
  searchParams?: SearchParams | Promise<SearchParams>;
};

export async function generateMetadata({ searchParams }: PageProps) {
  const params = await resolveSearchParams(searchParams);
  const username = getStringParam(params.username).trim();

  return buildPageMetadata({
    title: 'OSRS Progression Tracker',
    description:
      'Track your Old School RuneScape progression: ironman milestones, bosses, gear unlocks, quests, diaries, and achievements.',
    canonicalPath: '/progression',
    noIndex: Boolean(username),
  });
}

async function resolveSearchParams(
  searchParams: PageProps['searchParams']
): Promise<SearchParams> {
  if (!searchParams) return {};
  return Promise.resolve(searchParams);
}

function getStringParam(value: string | string[] | undefined): string {
  if (!value) return '';
  return Array.isArray(value) ? (value[0] ?? '') : value;
}

export default async function ProgressionPage({ searchParams }: PageProps) {
  const params = await resolveSearchParams(searchParams);
  const initialUsername = getStringParam(params.username).trim();
  const initialMode = getStringParam(params.mode).trim() || 'auto';

  return (
    <section>
      <ProgressionPageClient
        initialMode={initialMode}
        initialUsername={initialUsername}
      />
    </section>
  );
}
