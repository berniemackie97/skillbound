import type { GameMode } from '@skillbound/hiscores';

export type LookupMode = GameMode | 'auto';

export const MODE_ALIASES: Record<string, LookupMode> = {
  auto: 'auto',
  normal: 'normal',
  iron: 'ironman',
  ironman: 'ironman',
  uim: 'ultimate-ironman',
  ultimate: 'ultimate-ironman',
  'ultimate-ironman': 'ultimate-ironman',
  hc: 'hardcore-ironman',
  hardcore: 'hardcore-ironman',
  'hardcore-ironman': 'hardcore-ironman',
};

export const AUTO_MODE_ORDER: GameMode[] = [
  'normal',
  'ironman',
  'hardcore-ironman',
  'ultimate-ironman',
];

export function resolveLookupMode(mode: string): LookupMode | null {
  return MODE_ALIASES[mode] ?? null;
}
