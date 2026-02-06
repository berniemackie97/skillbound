import { ActivityTilesPanel } from '@/components/lookup/activity-tiles-panel';
import { LookupActions } from '@/components/lookup/lookup-actions';
import { LookupPanel } from '@/components/lookup/lookup-panel';
import { SkillTilesPanel } from '@/components/lookup/skill-tiles-panel';
import {
  fetchLookup,
  getOverallSkill,
  getTopActivities,
  getTopSkills,
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
  const { username, mode } = await parseLookupSearchParams(searchParams);

  const { lookup, error } = username
    ? await fetchLookup({ username, mode })
    : { lookup: null, error: null };

  const overall = getOverallSkill(lookup);
  const skillTiles = getTopSkills(lookup);
  const activityTiles = getTopActivities(lookup);

  return (
    <section>
      <LookupPanel
        actions={<LookupActions lookup={lookup} />}
        activityTiles={activityTiles}
        error={error}
        lookup={lookup}
        mode={mode}
        overall={overall}
        skillTiles={skillTiles}
        username={username}
      />

      {lookup ? <SkillTilesPanel skills={skillTiles} /> : null}
      {lookup ? <ActivityTilesPanel activities={activityTiles} /> : null}
    </section>
  );
}
