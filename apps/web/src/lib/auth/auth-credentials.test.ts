import { describe, expect, it } from 'vitest';

import {
  credentialsSchema,
  parseLoginIdentifier,
  registrationSchema,
} from './auth-credentials';

describe('auth credentials schema', () => {
  it('parses email identifiers', () => {
    const parsed = credentialsSchema.parse({
      identifier: 'USER@Example.COM',
      password: 'password123',
    });

    const identifier = parseLoginIdentifier(parsed.identifier);
    expect(identifier).toEqual({
      type: 'email',
      value: 'user@example.com',
    });
  });

  it('parses username identifiers', () => {
    const parsed = credentialsSchema.parse({
      identifier: 'Skillbound_01',
      password: 'password123',
    });

    const identifier = parseLoginIdentifier(parsed.identifier);
    expect(identifier).toEqual({
      type: 'username',
      value: 'skillbound_01',
    });
  });

  it('allows optional usernames on registration', () => {
    const parsed = registrationSchema.parse({
      email: 'player@example.com',
      password: 'password123',
      username: '',
    });

    expect(parsed.username).toBeUndefined();
  });
});
