import { describe, expect, it } from 'vitest';

import {
  accounts,
  authenticators,
  characterProfiles,
  characterSnapshots,
  sessions,
  userCharacters,
  users,
  userSettings,
  verificationTokens,
} from './schema';

describe('database schema exports', () => {
  it('exposes core user tables', () => {
    expect(users).toBeDefined();
    expect(accounts).toBeDefined();
    expect(sessions).toBeDefined();
    expect(verificationTokens).toBeDefined();
    expect(authenticators).toBeDefined();
    expect(userSettings).toBeDefined();
  });

  it('exposes character tables', () => {
    expect(characterProfiles).toBeDefined();
    expect(userCharacters).toBeDefined();
    expect(characterSnapshots).toBeDefined();
  });
});
