import { normalizeActivityScore } from '@/lib/character/normalize-activity-score';

import type { LookupResponse } from './lookup-types';
import { isCharacterSaved as isCharacterSavedUtil } from './lookup-utils';

export function getOverallSkill(lookup: LookupResponse | null) {
  return lookup?.data.skills.find((skill) => skill.key === 'overall') ?? null;
}

export function getTopSkills(lookup: LookupResponse | null) {
  return (
    lookup?.data.skills
      .filter((skill) => skill.isKnownSkill && skill.key !== 'overall')
      .sort((a, b) => b.level - a.level)
      .slice(0, 24) ?? []
  );
}

export function getTopActivities(lookup: LookupResponse | null) {
  return (
    lookup?.data.activities
      .map((activity) => ({
        ...activity,
        score: normalizeActivityScore(activity.key, activity.score),
      }))
      .filter((activity) => activity.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12) ?? []
  );
}

export function isCharacterSaved(args: {
  lookup: LookupResponse | null;
  savedCharacters: Array<{ displayName: string; mode: string }>;
}): boolean {
  return isCharacterSavedUtil(args);
}
