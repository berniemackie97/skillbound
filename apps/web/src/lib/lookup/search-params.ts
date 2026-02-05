import type { ModeValue, SearchParams } from './lookup-types';
import { MODE_VALUES } from './lookup-types';

export type LookupSearchParamsInput = SearchParams | Promise<SearchParams>;

async function resolveSearchParams(
  input?: LookupSearchParamsInput
): Promise<SearchParams> {
  if (!input) return {};
  return Promise.resolve(input);
}

function getStringParam(value: string | string[] | undefined): string {
  if (!value) return '';
  return Array.isArray(value) ? (value[0] ?? '') : value;
}

function parseMode(raw: string): ModeValue {
  const value = raw.trim() as ModeValue;
  return MODE_VALUES.has(value) ? value : 'auto';
}

export async function parseLookupSearchParams(input?: LookupSearchParamsInput) {
  const params = await resolveSearchParams(input);
  const username = getStringParam(params.username).trim();
  const mode = parseMode(getStringParam(params.mode) || 'auto');

  return { username, mode };
}
