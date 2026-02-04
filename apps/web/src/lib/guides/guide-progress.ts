import {
  and,
  eq,
  guideProgress,
  type GuideProgress,
} from '@skillbound/database';

import { getDbClient } from '../db';

export async function getGuideProgressForCharacter(
  userCharacterId: string
): Promise<GuideProgress[]> {
  const db = getDbClient();
  return db
    .select()
    .from(guideProgress)
    .where(eq(guideProgress.userCharacterId, userCharacterId));
}

export async function getGuideProgressRecord(
  userCharacterId: string,
  templateId: string,
  version: number
): Promise<GuideProgress | null> {
  const db = getDbClient();
  const [progress] = await db
    .select()
    .from(guideProgress)
    .where(
      and(
        eq(guideProgress.userCharacterId, userCharacterId),
        eq(guideProgress.guideTemplateId, templateId),
        eq(guideProgress.guideVersion, version)
      )
    )
    .limit(1);

  return progress ?? null;
}
