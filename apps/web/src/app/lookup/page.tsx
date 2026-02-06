import { ActivityTilesPanel } from '@/components/lookup/activity-tiles-panel';
import { LookupPanel } from '@/components/lookup/lookup-panel';
import { SkillTilesPanel } from '@/components/lookup/skill-tiles-panel';
import { getSessionUser } from '@/lib/auth/auth-helpers';
import { getUserCharacters } from '@/lib/character/character-selection';
import {
  fetchLookup,
  getOverallSkill,
  getTopActivities,
  getTopSkills,
  isCharacterSaved,
} from '@/lib/lookup/lookup-data';
import {
  parseLookupSearchParams,
  type LookupSearchParamsInput,
} from '@/lib/lookup/search-params';
import { buildPageMetadata } from '@/lib/seo/metadata';

export async function generateMetadata({
  searchParams,
}: {
  searchParams?: LookupSearchParamsInput;
}) {
  const { username } = await parseLookupSearchParams(searchParams);

  return buildPageMetadata({
    title: 'OSRS Hiscores & Character Lookup',
    description:
      'Search OSRS hiscores and view a fast character summary with skills, activities, and rankings.',
    canonicalPath: '/lookup',
    noIndex: Boolean(username),
  });
}

export default async function LookupPage({
  searchParams,
}: {
  searchParams?: LookupSearchParamsInput;
}) {
  const sessionUser = await getSessionUser();
  const savedCharacters = sessionUser
    ? await getUserCharacters(sessionUser.id)
    : [];

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
    <section>
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
    </section>
  );
}
