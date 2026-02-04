import { describe, expect, it } from 'vitest';

import { hashPassword, verifyPassword } from './passwords';

describe('password hashing', () => {
  it('verifies the original password', async () => {
    const hash = await hashPassword('hunter2!');
    await expect(verifyPassword('hunter2!', hash)).resolves.toBe(true);
  });

  it('rejects incorrect passwords', async () => {
    const hash = await hashPassword('hunter2!');
    await expect(verifyPassword('wrong-password', hash)).resolves.toBe(false);
  });
});
