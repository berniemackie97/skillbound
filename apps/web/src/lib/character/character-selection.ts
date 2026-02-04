import {
  and,
  asc,
  characterProfiles,
  userCharacters,
  eq,
  sql,
  type CharacterProfile,
  type UserCharacter,
  userSettings,
} from '@skillbound/database';

import { getDbClient } from '../db';

export type CharacterSummary = {
  id: UserCharacter['id'];
  displayName: CharacterProfile['displayName'];
  mode: CharacterProfile['mode'];
  lastSyncedAt: CharacterProfile['lastSyncedAt'];
  tags: UserCharacter['tags'];
  notes: UserCharacter['notes'];
  isPublic: UserCharacter['isPublic'];
  archivedAt: UserCharacter['archivedAt'];
};

export type ActiveCharacterSelection = {
  character: CharacterSummary | null;
};

export async function getUserCharacters(
  userId: string,
  options: { includeArchived?: boolean } = {}
): Promise<CharacterSummary[]> {
  const includeArchived = options.includeArchived ?? false;
  const db = getDbClient();
  const conditions = [eq(userCharacters.userId, userId)];
  if (!includeArchived) {
    conditions.push(sql`${userCharacters.archivedAt} IS NULL`);
  }

  return db
    .select({
      id: userCharacters.id,
      displayName: characterProfiles.displayName,
      mode: characterProfiles.mode,
      lastSyncedAt: characterProfiles.lastSyncedAt,
      tags: userCharacters.tags,
      notes: userCharacters.notes,
      isPublic: userCharacters.isPublic,
      archivedAt: userCharacters.archivedAt,
    })
    .from(userCharacters)
    .innerJoin(
      characterProfiles,
      eq(userCharacters.profileId, characterProfiles.id)
    )
    .where(and(...conditions))
    .orderBy(asc(characterProfiles.displayName));
}

export async function getTradableCharacters(
  userId: string
): Promise<CharacterSummary[]> {
  const db = getDbClient();
  return db
    .select({
      id: userCharacters.id,
      displayName: characterProfiles.displayName,
      mode: characterProfiles.mode,
      lastSyncedAt: characterProfiles.lastSyncedAt,
      tags: userCharacters.tags,
      notes: userCharacters.notes,
      isPublic: userCharacters.isPublic,
      archivedAt: userCharacters.archivedAt,
    })
    .from(userCharacters)
    .innerJoin(
      characterProfiles,
      eq(userCharacters.profileId, characterProfiles.id)
    )
    .where(
      and(
        eq(userCharacters.userId, userId),
        eq(characterProfiles.mode, 'normal'),
        sql`${userCharacters.archivedAt} IS NULL`
      )
    )
    .orderBy(asc(characterProfiles.displayName));
}

export async function getActiveCharacter(
  userId: string
): Promise<ActiveCharacterSelection> {
  const db = getDbClient();
  const [row] = await db
    .select({
      characterId: userSettings.activeCharacterId,
    })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);

  if (!row?.characterId) {
    return { character: null };
  }

  const [character] = await db
    .select({
      id: userCharacters.id,
      displayName: characterProfiles.displayName,
      mode: characterProfiles.mode,
      lastSyncedAt: characterProfiles.lastSyncedAt,
      tags: userCharacters.tags,
      notes: userCharacters.notes,
      isPublic: userCharacters.isPublic,
      archivedAt: userCharacters.archivedAt,
    })
    .from(userCharacters)
    .innerJoin(
      characterProfiles,
      eq(userCharacters.profileId, characterProfiles.id)
    )
    .where(
      and(
        eq(userCharacters.id, row.characterId),
        eq(userCharacters.userId, userId)
      )
    )
    .limit(1);

  return { character: character ?? null };
}
