import { existsSync } from 'node:fs';
import path from 'node:path';

import { config as loadEnv } from 'dotenv';

const candidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../.env'),
  path.resolve(process.cwd(), '../../.env'),
  path.resolve(process.cwd(), '../../../.env'),
  path.resolve(process.cwd(), '../../../../.env'),
];

const envPath = candidates.find((candidate) => existsSync(candidate));

if (envPath) {
  loadEnv({ path: envPath });
} else {
  loadEnv();
}
