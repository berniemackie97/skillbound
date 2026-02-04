import type { Metadata } from 'next';

import { ComprehensiveProgression } from '@/components/progression/comprehensive-progression';
import { ProgressionBrowser } from '@/components/progression/progression-browser';
import { getSessionUser } from '@/lib/auth/auth-helpers';
import { getActiveCharacter } from '@/lib/character/character-selection';

export const metadata: Metadata = {
  title: 'Progression Tracker - SkillBound',
  description:
    'Track your ironman progression: bosses, gear, milestones, quests, and achievements',
};

type SearchParams = {
  username?: string | string[];
  mode?: string | string[];
};

type PageProps = {
  // Next.js may provide searchParams as either an object or a Promise depending on
  // route configuration and framework version. Handle both.
  searchParams?: SearchParams | Promise<SearchParams>;
};

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
    <main className="page">
      {character ? (
        <ComprehensiveProgression
          characterId={character.id}
          characterName={character.displayName}
        />
      ) : (
        <ProgressionBrowser
          initialUsername={initialUsername}
          initialMode={initialMode}
          signedIn={Boolean(user)}
          hasActiveCharacter={Boolean(character)}
        />
      )}
    </main>
  );
}
