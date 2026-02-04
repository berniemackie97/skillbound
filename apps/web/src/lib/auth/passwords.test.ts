import { describe, expect, it } from 'vitest';

import { hashPassword, verifyPassword } from './passwords';

// Argon2 is intentionally slow for security, so we need longer timeouts
describe('password hashing', () => {
  it('verifies the original password', { timeout: 30000 }, async () => {
    const hash = await hashPassword('hunter2!');
    await expect(verifyPassword('hunter2!', hash)).resolves.toBe(true);
  });

  it('rejects incorrect passwords', { timeout: 30000 }, async () => {
    const hash = await hashPassword('hunter2!');
    await expect(verifyPassword('wrong-password', hash)).resolves.toBe(false);
  });
});
