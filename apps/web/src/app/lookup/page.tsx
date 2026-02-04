import type { Metadata } from 'next';


import { ActivityTilesPanel } from '@/components/lookup/activity-tiles-panel';
import { LookupPanel } from '@/components/lookup/lookup-panel';
import { SkillTilesPanel } from '@/components/lookup/skill-tiles-panel';
import { getSessionUser } from '@/lib/auth/auth-helpers';
import { getUserCharacters } from '@/lib/character/character-selection';
import { fetchLookup, getOverallSkill, getTopActivities, getTopSkills, isCharacterSaved } from '@/lib/lookup/lookup-data';
import { parseLookupSearchParams, type LookupSearchParamsInput } from '@/lib/lookup/search-params';

export const metadata: Metadata = {
  title: 'Character Lookup - SkillBound',
  description: 'Fetch OSRS hiscores data and render a quick character dashboard.',
};

export default async function LookupPage({
  searchParams,
}: {
  searchParams?: LookupSearchParamsInput;
}) {
  const sessionUser = await getSessionUser();
  const savedCharacters = sessionUser ? await getUserCharacters(sessionUser.id) : [];

  const { username, mode } = await parseLookupSearchParams(searchParams);

  const { lookup, error } = username
    ? await fetchLookup({ username, mode })
    : { lookup: null, error: null };

  const overall = getOverallSkill(lookup);
  const skillTiles = getTopSkills(lookup);
  const activityTiles = getTopActivities(lookup);

  const saved = isCharacterSaved({
    lookup,
    savedCharacters,
  });

  return (
    <main className="page">
      <LookupPanel
        activityTiles={activityTiles}
        error={error}
        isSaved={saved}
        lookup={lookup}
        mode={mode}
        overall={overall}
        sessionUser={sessionUser}
        skillTiles={skillTiles}
        username={username}
      />

      {lookup ? <SkillTilesPanel skills={skillTiles} /> : null}
      {lookup ? <ActivityTilesPanel activities={activityTiles} /> : null}
    </main>
  );
}