import { describe, expect, it, vi } from 'vitest';

const poolMock = vi.hoisted(() =>
  vi.fn<(config: unknown) => { config: unknown }>(() => ({ config: null }))
);
const drizzleMock = vi.hoisted(() =>
  vi.fn<(client: unknown) => { client: boolean }>(() => ({ client: true }))
);

vi.mock('pg', () => ({
  Pool: class Pool {
    constructor(config: unknown) {
      return poolMock(config);
    }
  },
}));

vi.mock('drizzle-orm/node-postgres', () => ({
  drizzle: (client: unknown) => drizzleMock(client),
}));

import { createDbClient } from './client';

describe('createDbClient', () => {
  const resetMocks = () => {
    poolMock.mockClear();
    drizzleMock.mockClear();
  };

  it('normalizes sslmode aliases and applies defaults', () => {
    resetMocks();
    poolMock.mockReturnValueOnce({ config: null });
    drizzleMock.mockReturnValueOnce({ client: true });

    createDbClient({
      connectionString:
        'postgres://user:pass@localhost:5432/db?sslmode=require',
    });

    const poolConfig = poolMock.mock.calls[0]?.[0] as
      | { connectionString?: string; max?: number }
      | undefined;
    expect(poolConfig?.connectionString).toContain('sslmode=verify-full');
    expect(poolConfig?.max).toBe(10);
    expect(drizzleMock).toHaveBeenCalledTimes(1);
  });

  it('preserves invalid connection strings', () => {
    resetMocks();
    poolMock.mockReturnValueOnce({ config: null });
    drizzleMock.mockReturnValueOnce({ client: true });

    createDbClient({ connectionString: 'not-a-url' });

    const poolConfig = poolMock.mock.calls[0]?.[0] as
      | { connectionString?: string }
      | undefined;
    expect(poolConfig?.connectionString).toBe('not-a-url');
  });

  it('accepts custom max connection settings', () => {
    resetMocks();
    poolMock.mockReturnValueOnce({ config: null });
    drizzleMock.mockReturnValueOnce({ client: true });

    createDbClient({
      connectionString: 'postgres://user:pass@localhost:5432/db',
      maxConnections: 25,
    });

    const poolConfig = poolMock.mock.calls[0]?.[0] as
      | { max?: number }
      | undefined;
    expect(poolConfig?.max).toBe(25);
  });
});
