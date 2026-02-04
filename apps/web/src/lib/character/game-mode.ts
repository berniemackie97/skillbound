import type { GameMode } from '@skillbound/hiscores';

/**
 * Database game mode type (from character schema)
 */
export type DbGameMode =
  | 'normal'
  | 'ironman'
  | 'hardcore'
  | 'ultimate'
  | 'group-ironman'
  | 'hardcore-group-ironman'
  | 'unranked-group-ironman';

/**
 * Convert database game mode to hiscores game mode
 */
export function dbModeToHiscoresMode(dbMode: DbGameMode): GameMode {
  switch (dbMode) {
    case 'normal':
      return 'normal';
    case 'ironman':
      return 'ironman';
    case 'hardcore':
      return 'hardcore-ironman';
    case 'ultimate':
      return 'ultimate-ironman';
    case 'group-ironman':
    case 'hardcore-group-ironman':
    case 'unranked-group-ironman':
      // Group ironman modes use normal hiscores
      return 'normal';
  }
}

/**
 * Convert hiscores game mode to database game mode
 */
export function hiscoresModeToDbMode(hiscoresMode: GameMode): DbGameMode {
  switch (hiscoresMode) {
    case 'normal':
      return 'normal';
    case 'ironman':
      return 'ironman';
    case 'hardcore-ironman':
      return 'hardcore';
    case 'ultimate-ironman':
      return 'ultimate';
  }
}
