import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

const envPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../.env'
);
loadEnv({ path: envPath });

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './src/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env['DATABASE_URL'] ?? '',
  },
  verbose: true,
  strict: true,
});
