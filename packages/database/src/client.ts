import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from './schema';

/**
 * Database client configuration
 */
export interface DbConfig {
  connectionString: string;
  maxConnections?: number;
}

/**
 * Create a database client with connection pooling
 */
export function createDbClient(config: DbConfig) {
  const pool = new Pool({
    connectionString: config.connectionString,
    max: config.maxConnections ?? 10,
  });

  return drizzle(pool, { schema });
}

/**
 * Database client type
 */
export type DbClient = ReturnType<typeof createDbClient>;
