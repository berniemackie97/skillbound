import type { DbClient, CharacterProfile } from '@skillbound/database';
import { characterProfiles, characterSnapshots, eq } from '@skillbound/database';
import {
  HiscoresNotFoundError,
  HiscoresRateLimitError,
  HiscoresServerError,
  lookupPlayer,
  type AccountType,
  type ParsedRuneLiteData,
} from '@skillbound/hiscores';

import { updateContentDefinitionsFromSnapshot } from '../content/content-sync';
import { logger } from '../logging/logger';
import { buildSnapshotInsert } from '../snapshots/snapshots';

import { dbModeToHiscoresMode, hiscoresModeToDbMode } from './game-mode';
import { syncCharacterStateFromRunelite } from './runelite-state';


export type CharacterSyncResult = {
  snapshot: typeof characterSnapshots.$inferSelect;
  capturedAt: string;
  dataSource: 'runelite' | 'hiscores';
  warning?: string;
  runelite?: ParsedRuneLiteData;
};

/**
 * Map game mode to RuneLite account type
 */
function gameModeToAccountType(
  gameMode:
    | 'normal'
    | 'ironman'
    | 'hardcore'
    | 'ultimate'
    | 'group-ironman'
    | 'hardcore-group-ironman'
    | 'unranked-group-ironman'
): AccountType {
  switch (gameMode) {
    case 'ironman':
      return 'IRONMAN';
    case 'hardcore':
      return 'HARDCORE_IRONMAN';
    case 'ultimate':
      return 'ULTIMATE_IRONMAN';
    case 'group-ironman':
      return 'GROUP_IRONMAN';
    case 'hardcore-group-ironman':
      return 'HARDCORE_GROUP_IRONMAN';
    case 'unranked-group-ironman':
      return 'UNRANKED_GROUP_IRONMAN';
    case 'normal':
    default:
      return 'STANDARD';
  }
}

export async function syncCharacter(
  db: DbClient,
  profile: CharacterProfile,
  options: { userCharacterId?: string | null } = {}
): Promise<CharacterSyncResult> {
  const accountType = gameModeToAccountType(profile.mode);
  const hiscoresMode = dbModeToHiscoresMode(profile.mode);

  // Try with the stored account type first (single hiscores hit)
  let playerData: Awaited<ReturnType<typeof lookupPlayer>>;
  try {
    playerData = await lookupPlayer(profile.displayName, {
      accountType,
      strictHiscores: false,
      skipRuneLite: false,
      hiscoresMode,
      hiscoresRetries: 0,
    });
  } catch (error) {
    if (error instanceof HiscoresNotFoundError) {
      // Fallback to auto-detect once if stored mode is wrong
      playerData = await lookupPlayer(profile.displayName, {
        accountType: gameModeToAccountType('normal'),
        strictHiscores: false,
        skipRuneLite: false,
        hiscoresRetries: 0,
      });
    } else {
      throw error;
    }
  }

  // If we got hiscores data, check if the mode matches the stored mode
  // If not, the account type might have changed or been incorrectly detected initially
  const dbMode = hiscoresModeToDbMode(playerData.hiscores.mode);
  if (dbMode !== profile.mode) {
    // The hiscores mode doesn't match stored mode - update the character's mode
    await db
      .update(characterProfiles)
      .set({ mode: dbMode })
      .where(eq(characterProfiles.id, profile.id));

    if (playerData.source === 'hiscores') {
      const correctAccountType = gameModeToAccountType(dbMode);
      const retryData = await lookupPlayer(profile.displayName, {
        accountType: correctAccountType,
        strictHiscores: false,
        skipRuneLite: false,
        hiscoresMode: playerData.hiscores.mode,
        hiscoresRetries: 0,
      });

      // Use the retry data if it got RuneLite data (better than hiscores-only)
      if (retryData.source === 'runelite' || retryData.runelite) {
        playerData = retryData;
      }
    }
  }

  const snapshotInsert = buildSnapshotInsert(
    profile.id,
    playerData.hiscores,
    playerData.source,
    playerData.warning,
    playerData.runelite
  );

  // Use transaction to ensure snapshot creation and character update are atomic
  const snapshot = await db.transaction(async (tx) => {
    const [createdSnapshot] = await tx
      .insert(characterSnapshots)
      .values(snapshotInsert)
      .returning();

    if (!createdSnapshot) {
      throw new Error('Failed to create snapshot');
    }

    await tx
      .update(characterProfiles)
      .set({ lastSyncedAt: playerData.timestamp })
      .where(eq(characterProfiles.id, profile.id));

    return createdSnapshot;
  });

  // Update content definitions from this snapshot
  // This keeps our database in sync as users sync their characters
  if (playerData.runelite) {
    try {
      const contentUpdates = await updateContentDefinitionsFromSnapshot(
        db,
        snapshot
      );
      if (
        contentUpdates.questsAdded > 0 ||
        contentUpdates.diariesAdded > 0 ||
        contentUpdates.tasksAdded > 0
      ) {
        logger.info(
          { contentUpdates },
          'Content definitions updated from snapshot'
        );
      }
    } catch (error) {
      // Don't fail the sync if content update fails
      logger.error({ err: error }, 'Failed to update content definitions');
    }
  }

  const result: CharacterSyncResult = {
    snapshot,
    capturedAt: playerData.timestamp.toISOString(),
    dataSource: playerData.source,
  };

  if (playerData.runelite) {
    result.runelite = playerData.runelite;

    if (options.userCharacterId) {
      try {
        await syncCharacterStateFromRunelite(
          options.userCharacterId,
          playerData.runelite,
          playerData.timestamp
        );
      } catch (error) {
        logger.error(
          { err: error, characterId: options.userCharacterId },
          'Failed to sync character_state from RuneLite data'
        );
      }
    }
  }

  if (playerData.warning) {
    result.warning = playerData.warning;
  }

  return result;
}

export function isHiscoresError(error: unknown): boolean {
  return (
    error instanceof HiscoresNotFoundError ||
    error instanceof HiscoresRateLimitError ||
    error instanceof HiscoresServerError
  );
}
