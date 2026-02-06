import { ComprehensiveProgression } from '@/components/progression/comprehensive-progression';
import { ProgressionBrowser } from '@/components/progression/progression-browser';
import { getSessionUser } from '@/lib/auth/auth-helpers';
import { getActiveCharacter } from '@/lib/character/character-selection';
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
  const user = await getSessionUser();
  const activeSelection = user ? await getActiveCharacter(user.id) : null;
  const character = activeSelection?.character ?? null;

  const params = await resolveSearchParams(searchParams);
  const initialUsername = getStringParam(params.username).trim();
  const initialMode = getStringParam(params.mode).trim() || 'auto';

  return (
    <section>
      {character ? (
        <ComprehensiveProgression
          characterId={character.id}
          characterName={character.displayName}
        />
      ) : (
        <ProgressionBrowser
          hasActiveCharacter={Boolean(character)}
          initialMode={initialMode}
          initialUsername={initialUsername}
          signedIn={Boolean(user)}
        />
      )}
    </section>
  );
}
