import { createHiscoresClient } from '../core/client';
import type { GameMode, HiscoresResponse } from '../core/types';
import {
  fetchAndParseRuneLitePlayer,
  RuneLiteAPIError,
} from '../runelite/runelite-client';
import type { AccountType, ParsedRuneLiteData } from '../runelite/runelite-types';

export type DataSource = 'runelite' | 'hiscores';

export interface UnifiedPlayerData {
  source: DataSource;
  username: string;
  timestamp: Date;

  // RuneLite data (only when source === 'runelite')
  runelite?: ParsedRuneLiteData;

  // Hiscores data (always present as fallback)
  hiscores: HiscoresResponse;

  // Warning message if fallback was used
  warning?: string;
}

export interface LookupOptions {
  /**
   * Account type for RuneLite lookup
   * @default 'STANDARD'
   */
  accountType?: AccountType;

  /**
   * If true, skip RuneLite and go straight to hiscores
   * @default false
   */
  skipRuneLite?: boolean;

  /**
   * If true, throw error on hiscores failure instead of returning partial data
   * @default false
   */
  strictHiscores?: boolean;

  /**
   * Override hiscores lookup mode when RuneLite is unavailable
   */
  hiscoresMode?: GameMode;

  /**
   * Override hiscores retry behavior
   */
  hiscoresRetries?: number;
  hiscoresRetryDelay?: number;
}

/**
 * Unified player lookup that tries RuneLite first, falls back to Hiscores
 */
export async function lookupPlayer(
  username: string,
  options: LookupOptions = {}
): Promise<UnifiedPlayerData> {
  const {
    accountType = 'STANDARD',
    skipRuneLite = false,
    strictHiscores = false,
    hiscoresMode,
    hiscoresRetries,
    hiscoresRetryDelay,
  } = options;

  const hiscoresClient = createHiscoresClient({
    ...(hiscoresRetries !== undefined ? { retries: hiscoresRetries } : {}),
    ...(hiscoresRetryDelay !== undefined
      ? { retryDelay: hiscoresRetryDelay }
      : {}),
  });

  let runeliteData: ParsedRuneLiteData | undefined;
  let hiscoresData: HiscoresResponse | undefined;
  let warning: string | undefined;

  // Try RuneLite first (unless skipped)
  if (!skipRuneLite) {
    // Try the specified account type first
    try {
      runeliteData = await fetchAndParseRuneLitePlayer(username, accountType);
    } catch (error) {
      // If the specified type fails and it's not STANDARD, try STANDARD as fallback
      // This handles cases where players' data is stored under wrong account type
      if (accountType !== 'STANDARD') {
        try {
          runeliteData = await fetchAndParseRuneLitePlayer(
            username,
            'STANDARD'
          );
          console.warn(
            `RuneLite: Found ${username} data under STANDARD instead of ${accountType}`
          );
        } catch (_standardError) {
          // Both failed, log and continue to hiscores
          if (error instanceof RuneLiteAPIError) {
            warning = `RuneLite data unavailable: ${error.message}. Using OSRS Hiscores instead.`;
            console.warn(warning);
          } else {
            warning = 'RuneLite lookup failed. Using OSRS Hiscores instead.';
            console.warn(warning, error);
          }
        }
      } else {
        // STANDARD failed, no fallback needed
        if (error instanceof RuneLiteAPIError) {
          warning = `RuneLite data unavailable: ${error.message}. Using OSRS Hiscores instead.`;
          console.warn(warning);
        } else {
          warning = 'RuneLite lookup failed. Using OSRS Hiscores instead.';
          console.warn(warning, error);
        }
      }
    }

    // If we got RuneLite data, try to get hiscores too for completeness
    if (runeliteData) {
      try {
        hiscoresData = hiscoresMode
          ? await hiscoresClient.lookup(username, hiscoresMode)
          : await hiscoresClient.lookupAuto(username);
      } catch (hiscoresError) {
        // RuneLite data is enough, hiscores failure is not critical
        console.warn(
          'Hiscores fetch failed but RuneLite data available:',
          hiscoresError
        );
      }

      return {
        source: 'runelite',
        username: runeliteData.username,
        timestamp: new Date(runeliteData.timestamp),
        runelite: runeliteData,
        hiscores: hiscoresData || createHiscoresFromRuneLite(runeliteData),
      };
    }
  }

  // Fallback to Hiscores
  try {
    hiscoresData = hiscoresMode
      ? await hiscoresClient.lookup(username, hiscoresMode)
      : await hiscoresClient.lookupAuto(username);

    const result: UnifiedPlayerData = {
      source: 'hiscores',
      username,
      timestamp: new Date(),
      hiscores: hiscoresData,
    };

    if (warning) {
      result.warning = warning;
    }

    return result;
  } catch (hiscoresError) {
    if (strictHiscores) {
      throw hiscoresError;
    }

    // If both failed, throw the hiscores error
    const errorMessage = warning
      ? `${warning} Additionally, Hiscores lookup also failed.`
      : 'Player lookup failed for both RuneLite and Hiscores.';

    throw new Error(errorMessage, { cause: hiscoresError });
  }
}

/**
 * Create a minimal HiscoresResponse from RuneLite levels
 * Used when hiscores fetch fails but we have RuneLite data
 */
function createHiscoresFromRuneLite(
  runelite: ParsedRuneLiteData
): HiscoresResponse {
  const levels = runelite.levels;
  const skillNames = [
    'Overall',
    'Attack',
    'Defence',
    'Strength',
    'Hitpoints',
    'Ranged',
    'Prayer',
    'Magic',
    'Cooking',
    'Woodcutting',
    'Fletching',
    'Fishing',
    'Firemaking',
    'Crafting',
    'Smithing',
    'Mining',
    'Herblore',
    'Agility',
    'Thieving',
    'Slayer',
    'Farming',
    'Runecraft',
    'Hunter',
    'Construction',
  ];

  const skills = skillNames.map((name, id) => ({
    id,
    name,
    key: name.toLowerCase(),
    isKnownSkill: true,
    rank: -1,
    level:
      levels[name] || (name === 'Hitpoints' ? 10 : name === 'Overall' ? 0 : 1),
    xp: 0,
  }));

  return {
    username: runelite.username,
    displayName: runelite.username,
    mode: 'normal' as const,
    capturedAt: runelite.timestamp,
    skills,
    activities: [],
  };
}
