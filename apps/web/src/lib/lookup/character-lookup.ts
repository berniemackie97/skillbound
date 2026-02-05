import {
  lookupPlayer,
  type AccountType,
  type GameMode,
  type UnifiedPlayerData,
} from '@skillbound/hiscores';

/**
 * Maps game mode string to RuneLite account type
 */
export function gameModeToAccountType(mode: GameMode): AccountType {
  switch (mode) {
    case 'ironman':
      return 'IRONMAN';
    case 'hardcore-ironman':
      return 'HARDCORE_IRONMAN';
    case 'ultimate-ironman':
      return 'ULTIMATE_IRONMAN';
    case 'normal':
    default:
      return 'STANDARD';
  }
}

/**
 * Looks up a player with auto-mode retry logic
 * Tries each game mode in order until one succeeds
 *
 * This consolidates the duplicate logic from:
 * - /api/characters/lookup/route.ts
 * - /api/characters/route.ts (lookupPlayerForCreate)
 */
export async function lookupPlayerWithAutoMode(
  displayName: string,
  mode: GameMode | 'auto',
  options: {
    strictHiscores?: boolean;
  } = {}
): Promise<UnifiedPlayerData & { resolvedMode: GameMode }> {
  if (mode === 'auto') {
    const data = await lookupPlayer(displayName, {
      accountType: gameModeToAccountType('normal'),
      strictHiscores: options.strictHiscores ?? false,
      skipRuneLite: false,
      hiscoresRetries: 0,
    });

    return {
      ...data,
      resolvedMode: data.hiscores.mode,
    };
  }

  // Specific mode requested
  const accountType = gameModeToAccountType(mode);
  const data = await lookupPlayer(displayName, {
    accountType,
    strictHiscores: options.strictHiscores ?? false,
    skipRuneLite: false,
    hiscoresMode: mode,
    hiscoresRetries: 0,
  });

  return {
    ...data,
    resolvedMode: mode,
  };
}
