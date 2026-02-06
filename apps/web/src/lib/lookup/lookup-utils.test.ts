import { describe, expect, it } from 'vitest';

import type { LookupResponse } from './lookup-types';
import { isCharacterSaved } from './lookup-utils';

const baseLookup: LookupResponse = {
  data: {
    username: 'GirlCauk',
    displayName: 'GirlCauk',
    mode: 'normal',
    capturedAt: new Date().toISOString(),
    skills: [],
    activities: [],
  },
  meta: {
    cached: false,
    mode: 'normal',
  },
};

describe('isCharacterSaved', () => {
  it('matches display names case-insensitively', () => {
    const saved = isCharacterSaved({
      lookup: baseLookup,
      savedCharacters: [{ displayName: 'girlcauk', mode: 'normal' }],
    });

    expect(saved).toBe(true);
  });

  it('returns false for different modes', () => {
    const saved = isCharacterSaved({
      lookup: baseLookup,
      savedCharacters: [{ displayName: 'GirlCauk', mode: 'ironman' }],
    });

    expect(saved).toBe(false);
  });

  it('returns false when no lookup is available', () => {
    const saved = isCharacterSaved({
      lookup: null,
      savedCharacters: [{ displayName: 'GirlCauk', mode: 'normal' }],
    });

    expect(saved).toBe(false);
  });
});
