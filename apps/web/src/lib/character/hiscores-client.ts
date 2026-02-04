import {
  createHiscoresClient,
  type HiscoresClient,
  type HiscoresClientConfig,
} from '@skillbound/hiscores';

import { getHiscoresCache, getHiscoresCacheTtlMs } from '../cache/cache';

let cachedClient: HiscoresClient | null = null;

function getUserAgent(): string | undefined {
  return (
    process.env['HISCORES_USER_AGENT'] ??
    process.env['SKILLBOUND_USER_AGENT'] ??
    process.env['INTEGRATIONS_USER_AGENT'] ??
    undefined
  );
}

export function getHiscoresClient(): HiscoresClient {
  if (cachedClient) {
    return cachedClient;
  }

  const config: HiscoresClientConfig = {
    cache: getHiscoresCache(),
    cacheTtlMs: getHiscoresCacheTtlMs(),
  };

  const userAgent = getUserAgent();
  if (userAgent) {
    config.userAgent = userAgent;
  }

  cachedClient = createHiscoresClient(config);

  return cachedClient;
}
