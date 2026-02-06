import { createDbClient, type DbClient } from '@skillbound/database';

import '../config/env';

let cachedClient: DbClient | null = null;

export function getDbClient(): DbClient {
  if (cachedClient) {
    return cachedClient;
  }

  const connectionString =
    process.env['DATABASE_URL'] ??
    process.env['POSTGRES_URL'] ??
    process.env['POSTGRES_URL_NON_POOLING'] ??
    process.env['DATABASE_URL_UNPOOLED'] ??
    process.env['POSTGRES_PRISMA_URL'];
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not configured. Set DATABASE_URL (preferred) or a supported Postgres env like POSTGRES_URL.'
    );
  }

  cachedClient = createDbClient({ connectionString });
  return cachedClient;
}
