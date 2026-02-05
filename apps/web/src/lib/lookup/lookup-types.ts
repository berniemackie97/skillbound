import type { HiscoresResponse } from '@skillbound/hiscores';

export type LookupMeta = {
  cached: boolean;
  mode: string;
};

export type LookupResponse = {
  data: HiscoresResponse;
  meta: LookupMeta;
};

export type ProblemDetails = {
  detail?: string;
};

export type SearchParams = {
  username?: string | string[];
  mode?: string | string[];
};

export const MODE_OPTIONS = [
  { value: 'auto', label: 'Auto detect' },
  { value: 'normal', label: 'Normal' },
  { value: 'ironman', label: 'Ironman' },
  { value: 'hardcore-ironman', label: 'Hardcore' },
  { value: 'ultimate-ironman', label: 'Ultimate' },
] as const;

export type ModeValue = (typeof MODE_OPTIONS)[number]['value'];

export const MODE_VALUES = new Set<ModeValue>(MODE_OPTIONS.map((m) => m.value));
