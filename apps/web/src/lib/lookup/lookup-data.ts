import { getServerBaseUrl } from '@/lib/config/server-url';

import type { LookupResponse, ModeValue, ProblemDetails } from './lookup-types';

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

export async function fetchLookup(args: { username: string; mode: ModeValue }) {
  const baseUrl = await getServerBaseUrl();
  const url = new URL('/api/characters/lookup', baseUrl);

  url.searchParams.set('username', args.username);
  url.searchParams.set('mode', args.mode);

  const response = await fetch(url, { cache: 'no-store' });

  let payload: LookupResponse | ProblemDetails;
  try {
    payload = (await response.json()) as LookupResponse | ProblemDetails;
  } catch {
    // If upstream returns non-JSON (proxy error, HTML, etc)
    return {
      lookup: null as LookupResponse | null,
      error: 'Lookup failed (invalid response). Please try again.',
    };
  }

  if (!response.ok) {
    return {
      lookup: null as LookupResponse | null,
      error: (payload as ProblemDetails).detail ?? 'Lookup failed. Please try again.',
    };
  }

  return {
    lookup: payload as LookupResponse,
    error: null as string | null,
  };
}

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
      .filter((activity) => activity.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12) ?? []
  );
}

export function isCharacterSaved(args: {
  lookup: LookupResponse | null;
  savedCharacters: Array<{ displayName: string; mode: string }>;
}): boolean {
  const { lookup, savedCharacters } = args;
  if (!lookup) return false;

  return savedCharacters.some((character) => {
    const sameName =
      normalizeName(character.displayName) === normalizeName(lookup.data.displayName);
    const sameMode = character.mode === lookup.data.mode;
    return sameName && sameMode;
  });
}