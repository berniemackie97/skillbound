import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from './schema';

const SSL_MODE_ALIASES = new Set(['prefer', 'require', 'verify-ca']);

function normalizeConnectionString(connectionString: string): string {
  try {
    const url = new URL(connectionString);
    const sslmode = url.searchParams.get('sslmode');
    if (sslmode && SSL_MODE_ALIASES.has(sslmode)) {
      // Preserve current behavior and avoid pg-connection-string warnings.
      url.searchParams.set('sslmode', 'verify-full');
      return url.toString();
    }
  } catch {
    // Fall back to the original string if parsing fails.
  }
  return connectionString;
}

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
  const connectionString = normalizeConnectionString(config.connectionString);
  const pool = new Pool({
    connectionString,
    max: config.maxConnections ?? 10,
  });

  return drizzle(pool, { schema });
}

/**
 * Database client type
 */
export type DbClient = ReturnType<typeof createDbClient>;
