import { createDbClient, type DbClient } from '@skillbound/database';

import '../config/env';

let cachedClient: DbClient | null = null;

export function getDbClient(): DbClient {
  if (cachedClient) {
    return cachedClient;
  }

  const connectionString = process.env['DATABASE_URL'];
  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured.');
  }

  cachedClient = createDbClient({ connectionString });
  return cachedClient;
}
