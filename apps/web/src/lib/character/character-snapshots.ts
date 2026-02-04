import {
  characterSnapshots,
  desc,
  eq,
  userCharacters,
  type CharacterSnapshot,
} from '@skillbound/database';

import { getDbClient } from '../db';

export async function getLatestCharacterSnapshot(
  characterId: string
): Promise<CharacterSnapshot | null> {
  const db = getDbClient();
  const [row] = await db
    .select({ profileId: userCharacters.profileId })
    .from(userCharacters)
    .where(eq(userCharacters.id, characterId))
    .limit(1);

  if (!row?.profileId) {
    return null;
  }

  const [snapshot] = await db
    .select()
    .from(characterSnapshots)
    .where(eq(characterSnapshots.profileId, row.profileId))
    .orderBy(desc(characterSnapshots.capturedAt))
    .limit(1);

  return snapshot ?? null;
}
