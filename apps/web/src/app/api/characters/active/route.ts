import {
  characterProfiles,
  eq,
  userCharacters,
  userSettings,
} from '@skillbound/database';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createProblemDetails } from '@/lib/api/problem-details';
import { getSessionUser, unauthorizedResponse } from '@/lib/auth/auth-helpers';
import { getHiscoresCacheTtlMs } from '@/lib/cache/cache';
import { isHiscoresError, syncCharacter } from '@/lib/character/character-sync';
import { getDbClient } from '@/lib/db';

const payloadSchema = z.object({
  characterId: z.string().uuid(),
});

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return unauthorizedResponse();
  }

  const contentType = request.headers.get('content-type') ?? '';
  let payload: unknown = null;

  if (contentType.includes('application/json')) {
    payload = (await request.json().catch(() => null)) as unknown;
  } else {
    const formData = await request.formData().catch(() => null);
    if (formData) {
      const characterId = formData.get('characterId');
      payload = {
        characterId: typeof characterId === 'string' ? characterId : null,
      };
    }
  }
  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid request',
      detail: 'Provide a valid character id.',
      errors: parsed.error.issues,
    });
    return NextResponse.json(problem, { status: problem.status });
  }

  const db = getDbClient();
  const [row] = await db
    .select({
      userCharacter: userCharacters,
      profile: characterProfiles,
    })
    .from(userCharacters)
    .innerJoin(
      characterProfiles,
      eq(userCharacters.profileId, characterProfiles.id)
    )
    .where(eq(userCharacters.id, parsed.data.characterId))
    .limit(1);

  if (!row?.userCharacter || row.userCharacter.userId !== user.id) {
    const problem = createProblemDetails({
      status: 404,
      title: 'Character not found',
      detail: 'No saved character exists for that id.',
    });
    return NextResponse.json(problem, { status: problem.status });
  }

  const now = new Date();
  await db
    .insert(userSettings)
    .values({
      userId: user.id,
      activeCharacterId: row.userCharacter.id,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: {
        activeCharacterId: row.userCharacter.id,
        updatedAt: now,
      },
    });

  const staleMs = getHiscoresCacheTtlMs();
  const lastSyncedAt = row.profile.lastSyncedAt?.getTime() ?? 0;
  const shouldSync =
    !row.profile.lastSyncedAt || Date.now() - lastSyncedAt > staleMs;

  let syncStatus: 'synced' | 'skipped' | 'failed' = 'skipped';
  let syncError: string | null = null;

  if (shouldSync) {
    try {
      await syncCharacter(db, row.profile, {
        userCharacterId: row.userCharacter.id,
      });
      syncStatus = 'synced';
    } catch (error) {
      syncStatus = 'failed';
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      syncError = isHiscoresError(error)
        ? errorMessage
        : 'Unexpected error while syncing character.';
      console.error('Active character sync error:', error);
    }
  }

  const responsePayload = {
    data: {
      activeCharacterId: row.userCharacter.id,
      synced: syncStatus,
      syncError,
    },
  };

  const accept = request.headers.get('accept') ?? '';
  if (accept.includes('text/html')) {
    const redirectTo = request.headers.get('referer') ?? '/';
    return NextResponse.redirect(redirectTo, { status: 303 });
  }

  return NextResponse.json(responsePayload);
}
