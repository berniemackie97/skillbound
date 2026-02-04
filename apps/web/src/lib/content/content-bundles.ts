import { readFile } from 'fs/promises';
import { join } from 'path';

import {
  parseContentBundle,
  seedBundle,
  type ContentBundle,
} from '@skillbound/content';

let cachedBundle: ContentBundle | null = null;
let cachedAt = 0;

export function invalidateContentBundleCache() {
  cachedBundle = null;
  cachedAt = 0;
}

function getCacheTtlMs(): number {
  const raw = process.env['CONTENT_BUNDLE_CACHE_TTL_MS'];
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : 5 * 60 * 1000;
}

function getUserAgent(): string | undefined {
  return (
    process.env['INTEGRATIONS_USER_AGENT'] ??
    process.env['SKILLBOUND_USER_AGENT'] ??
    undefined
  );
}

async function fetchBundleFromUrl(url: string): Promise<ContentBundle> {
  const userAgent = getUserAgent();
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (userAgent) {
    headers['User-Agent'] = userAgent;
  }

  const response = await fetch(url, {
    headers,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch content bundle (${response.status})`);
  }

  const json = (await response.json()) as unknown;
  return parseContentBundle(json);
}

async function fetchLocalGeneratedBundle(): Promise<ContentBundle | null> {
  try {
    const publicDir = join(process.cwd(), 'public', 'content');
    const bundlePath = join(publicDir, 'latest-bundle.json');
    const bundleJson = await readFile(bundlePath, 'utf-8');
    const json = JSON.parse(bundleJson) as unknown;
    return parseContentBundle(json);
  } catch (_error) {
    // Local bundle doesn't exist or is invalid
    return null;
  }
}

export async function getLatestContentBundle(): Promise<ContentBundle> {
  const ttl = getCacheTtlMs();
  const now = Date.now();

  if (cachedBundle && now - cachedAt < ttl) {
    return cachedBundle;
  }

  let bundle: ContentBundle;

  // 1. Try external URL (S3/R2) if configured
  const url = process.env['CONTENT_BUNDLE_URL'];
  if (url) {
    try {
      bundle = await fetchBundleFromUrl(url);
      cachedBundle = bundle;
      cachedAt = now;
      return bundle;
    } catch (error) {
      console.warn(
        'Failed to fetch from CONTENT_BUNDLE_URL, falling back:',
        error
      );
    }
  }

  // 2. Try local database-generated bundle
  const localBundle = await fetchLocalGeneratedBundle();
  if (localBundle) {
    cachedBundle = localBundle;
    cachedAt = now;
    return localBundle;
  }

  // 3. Fall back to seed bundle
  console.warn(
    'Using seed bundle as fallback - consider running bundle generation'
  );
  bundle = seedBundle;

  cachedBundle = bundle;
  cachedAt = now;
  return bundle;
}
