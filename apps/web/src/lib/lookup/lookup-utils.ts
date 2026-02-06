import type { LookupResponse } from './lookup-types';

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

export function isCharacterSaved(args: {
  lookup: LookupResponse | null;
  savedCharacters: Array<{ displayName: string; mode: string }>;
}): boolean {
  const { lookup, savedCharacters } = args;
  if (!lookup) return false;

  return savedCharacters.some((character) => {
    const sameName =
      normalizeName(character.displayName) ===
      normalizeName(lookup.data.displayName);
    const sameMode = character.mode === lookup.data.mode;
    return sameName && sameMode;
  });
}
