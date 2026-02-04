import {
  and,
  characterSnapshots,
  characterProfiles,
  desc,
  eq,
  ilike,
  inArray,
  userCharacters,
  userSettings,
  type CharacterProfile,
  type UserCharacter,
} from '@skillbound/database';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { mapErrorToResponse } from '@/lib/api/api-error-mapper';
import { applyRateLimitHeaders } from '@/lib/api/api-middleware';
import { createProblemDetails } from '@/lib/api/problem-details';
import { checkRateLimit, getClientIp } from '@/lib/api/rate-limit';
import { getSessionUser } from '@/lib/auth/auth-helpers';
import { parseCharacterListQuery } from '@/lib/character/character-list';
import { hiscoresModeToDbMode } from '@/lib/character/game-mode';
import { syncCharacterStateFromRunelite } from '@/lib/character/runelite-state';
import { getDbClient } from '@/lib/db';
import { importWiseOldManSnapshots } from '@/lib/integrations/wise-old-man-import';
import { logger } from '@/lib/logging/logger';
import { lookupPlayerWithAutoMode } from '@/lib/lookup/character-lookup';
import { resolveLookupMode } from '@/lib/lookup/lookup-mode';
import { buildSnapshotInsert } from '@/lib/snapshots/snapshots';

const payloadSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1)
    .max(12)
    .regex(/^[A-Za-z0-9 _-]+$/),
  mode: z
    .string()
    .optional()
    .default('auto')
    .transform((value) => value.toLowerCase()),
  tags: z.array(z.string().min(1).max(32)).max(25).optional(),
  notes: z.string().max(2000).optional(),
  isPublic: z.boolean().optional(),
});

function toPublicBoolean(value: boolean | undefined): boolean {
  return value ?? false;
}

function toProfileInsert(
  displayName: string,
  mode: CharacterProfile['mode'],
  capturedAt: string
) {
  return {
    displayName,
    mode,
    lastSyncedAt: new Date(capturedAt),
  };
}

function toUserCharacterInsert(
  userId: string,
  profileId: string,
  payload: z.infer<typeof payloadSchema>
) {
  return {
    userId,
    profileId,
    tags: payload.tags ?? [],
    notes: payload.notes ?? null,
    isPublic: toPublicBoolean(payload.isPublic),
  };
}

export async function POST(request: NextRequest) {
  const sessionUser = await getSessionUser();
  const rateLimitId = `characters:create:${getClientIp(request)}`;
  const rateLimitResult = await checkRateLimit(rateLimitId);

  if (!rateLimitResult.success) {
    const problem = createProblemDetails({
      status: 429,
      title: 'Rate limit exceeded',
      detail: 'Too many requests. Please try again later.',
    });

    const response = NextResponse.json(problem, { status: problem.status });
    return applyRateLimitHeaders(response, rateLimitResult);
  }

  const contentType = request.headers.get('content-type') ?? '';
  let payload: unknown = null;

  if (contentType.includes('application/json')) {
    payload = (await request.json().catch(() => null)) as unknown;
  } else {
    const formData = await request.formData().catch(() => null);
    if (formData) {
      payload = {
        displayName: formData.get('displayName')?.toString() ?? '',
        mode: formData.get('mode')?.toString() ?? 'auto',
        isPublic: formData.get('isPublic')?.toString() === 'true',
      };
    }
  }
  const parsed = payloadSchema.safeParse(payload);

  if (!parsed.success) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid character payload',
      detail: 'Provide a valid display name and mode.',
      errors: parsed.error.issues,
    });

    return NextResponse.json(problem, { status: problem.status });
  }

  const resolvedMode = resolveLookupMode(parsed.data.mode);
  if (!resolvedMode) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid mode',
      detail: `Unsupported mode: ${parsed.data.mode}`,
    });

    return NextResponse.json(problem, { status: problem.status });
  }

  try {
    const playerData = await lookupPlayerWithAutoMode(
      parsed.data.displayName,
      resolvedMode,
      { strictHiscores: false }
    );

    const db = getDbClient();

    // Use transaction to ensure atomic character creation + snapshot + settings update
    const { character, profile, snapshot } = await db.transaction(async (tx) => {
      const mode = hiscoresModeToDbMode(playerData.hiscores.mode);
      let profileRow: CharacterProfile | undefined;
      let userCharacter: UserCharacter | undefined;

      const [existingProfile] = await tx
        .select()
        .from(characterProfiles)
        .where(
          and(
            eq(characterProfiles.displayName, playerData.hiscores.displayName),
            eq(characterProfiles.mode, mode)
          )
        )
        .limit(1);

      if (existingProfile) {
        profileRow = existingProfile;
      } else {
        const [createdProfile] = await tx
          .insert(characterProfiles)
          .values(
            toProfileInsert(
              playerData.hiscores.displayName,
              mode,
              playerData.timestamp.toISOString()
            )
          )
          .returning();
        profileRow = createdProfile;
      }

      if (!profileRow) {
        throw new Error('Failed to create profile');
      }

      if (sessionUser) {
        const [existingUserCharacter] = await tx
          .select()
          .from(userCharacters)
          .where(
            and(
              eq(userCharacters.userId, sessionUser.id),
              eq(userCharacters.profileId, profileRow.id)
            )
          )
          .limit(1);

        if (existingUserCharacter) {
          userCharacter = existingUserCharacter;
        } else {
          const [createdUserCharacter] = await tx
            .insert(userCharacters)
            .values(
              toUserCharacterInsert(
                sessionUser.id,
                profileRow.id,
                parsed.data
              )
            )
            .returning();
          userCharacter = createdUserCharacter;
        }
      }

      const snapshotInsert = buildSnapshotInsert(
        profileRow.id,
        playerData.hiscores,
        playerData.source,
        playerData.warning,
        playerData.runelite
      );
      const [snap] = await tx
        .insert(characterSnapshots)
        .values(snapshotInsert)
        .returning();

      if (!snap) {
        throw new Error('Failed to create snapshot');
      }

      if (sessionUser && userCharacter) {
        const now = new Date();
        await tx
          .insert(userSettings)
          .values({
            userId: sessionUser.id,
            activeCharacterId: userCharacter.id,
            createdAt: now,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: userSettings.userId,
            set: {
              activeCharacterId: userCharacter.id,
              updatedAt: now,
            },
          });
      }

      return {
        character: userCharacter ?? null,
        profile: profileRow,
        snapshot: snap,
      };
    });

    if (playerData.runelite && character) {
      try {
        await syncCharacterStateFromRunelite(
          character.id,
          playerData.runelite,
          playerData.timestamp
        );
      } catch (error) {
        logger.error(
          { err: error, characterId: character.id },
          'Failed to sync character_state from RuneLite data'
        );
      }
    }

    const payload = {
      data: {
        character,
        profile,
        snapshot,
      },
    };

    try {
      await importWiseOldManSnapshots(db, profile, {
        period: 'year',
        maxSnapshots: 200,
        requireEarlier: true,
      });
    } catch (error) {
      logger.warn({ err: error }, 'Wise Old Man import skipped');
    }

    const accept = request.headers.get('accept') ?? '';
    if (accept.includes('text/html')) {
      const redirectTo = request.headers.get('referer') ?? '/characters';
      return NextResponse.redirect(redirectTo, { status: 303 });
    }

    return NextResponse.json(payload);
  } catch (error) {
    logger.error({ err: error }, 'Character create error');
    return mapErrorToResponse(error, request.url);
  }
}

export async function GET(request: NextRequest) {
  const parsedQuery = parseCharacterListQuery(request.nextUrl.searchParams);
  if (!parsedQuery.success) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid character query',
      detail: 'Query parameters did not match expected schema.',
      errors: parsedQuery.error.issues,
    });

    return NextResponse.json(problem, { status: problem.status });
  }

  const db = getDbClient();
  const filters = [eq(userCharacters.isPublic, true)];

  if (parsedQuery.data.ids && parsedQuery.data.ids.length > 0) {
    filters.push(inArray(userCharacters.id, parsedQuery.data.ids));
  }

  if (parsedQuery.data.mode) {
    filters.push(eq(characterProfiles.mode, parsedQuery.data.mode));
  }

  if (parsedQuery.data.search) {
    filters.push(
      ilike(characterProfiles.displayName, `%${parsedQuery.data.search}%`)
    );
  }

  const whereClause = filters.length === 1 ? filters[0] : and(...filters);

  const rows = await db
    .select({
      id: userCharacters.id,
      displayName: characterProfiles.displayName,
      mode: characterProfiles.mode,
      lastSyncedAt: characterProfiles.lastSyncedAt,
      tags: userCharacters.tags,
      isPublic: userCharacters.isPublic,
      createdAt: userCharacters.createdAt,
      updatedAt: userCharacters.updatedAt,
      profileId: characterProfiles.id,
    })
    .from(userCharacters)
    .innerJoin(
      characterProfiles,
      eq(userCharacters.profileId, characterProfiles.id)
    )
    .where(whereClause)
    .orderBy(desc(userCharacters.updatedAt))
    .limit(parsedQuery.data.limit);

  let snapshotMap = new Map<
    string,
    {
      id: string;
      capturedAt: Date;
      totalLevel: number;
      totalXp: number;
      combatLevel: number;
    }
  >();

  if (parsedQuery.data.includeSnapshots && rows.length > 0) {
    const snapshotRows = await db
      .select({
        id: characterSnapshots.id,
        profileId: characterSnapshots.profileId,
        capturedAt: characterSnapshots.capturedAt,
        totalLevel: characterSnapshots.totalLevel,
        totalXp: characterSnapshots.totalXp,
        combatLevel: characterSnapshots.combatLevel,
      })
      .from(characterSnapshots)
      .where(
        inArray(
          characterSnapshots.profileId,
          rows.map((row) => row.profileId)
        )
      )
      .orderBy(desc(characterSnapshots.capturedAt));

    snapshotMap = new Map();
    for (const snapshot of snapshotRows) {
      if (!snapshotMap.has(snapshot.profileId)) {
        snapshotMap.set(snapshot.profileId, {
          id: snapshot.id,
          capturedAt: snapshot.capturedAt,
          totalLevel: snapshot.totalLevel,
          totalXp: snapshot.totalXp,
          combatLevel: snapshot.combatLevel,
        });
      }
    }
  }

  const data = rows.map((row) => ({
    id: row.id,
    displayName: row.displayName,
    mode: row.mode,
    lastSyncedAt: row.lastSyncedAt,
    tags: row.tags ?? [],
    isPublic: row.isPublic,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    ...(parsedQuery.data.includeSnapshots
      ? { latestSnapshot: snapshotMap.get(row.profileId) ?? null }
      : {}),
  }));

  return NextResponse.json({
    data,
    meta: {
      count: data.length,
      limit: parsedQuery.data.limit,
      includeSnapshots: parsedQuery.data.includeSnapshots,
    },
  });
}
