import 'server-only';

import { getServerBaseUrl } from '@/lib/config/server-url';

import type { LookupResponse, ModeValue, ProblemDetails } from './lookup-types';

export async function fetchLookup(args: { username: string; mode: ModeValue }) {
  const baseUrl = await getServerBaseUrl();
  const url = new URL('/api/characters/lookup', baseUrl);

  url.searchParams.set('username', args.username);
  url.searchParams.set('mode', args.mode);

  const response = await fetch(url, { cache: 'no-store' });

  let payload: LookupResponse | ProblemDetails;
  try {
    payload = (await response.json()) as LookupResponse | ProblemDetails;
  } catch {
    // If upstream returns non-JSON (proxy error, HTML, etc)
    return {
      lookup: null as LookupResponse | null,
      error: 'Lookup failed (invalid response). Please try again.',
    };
  }

  if (!response.ok) {
    return {
      lookup: null as LookupResponse | null,
      error:
        (payload as ProblemDetails).detail ??
        'Lookup failed. Please try again.',
    };
  }

  return {
    lookup: payload as LookupResponse,
    error: null as string | null,
  };
}
