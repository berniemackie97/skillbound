import {
  characterProfiles,
  characterSnapshots,
  desc,
  eq,
  ilike,
  and,
} from '@skillbound/database';
import type { GameMode } from '@skillbound/hiscores';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { mapErrorToResponse } from '@/lib/api/api-error-mapper';
import {
  applyRateLimitHeaders,
  buildHiscoresCacheKey,
} from '@/lib/api/api-middleware';
import { createProblemDetails } from '@/lib/api/problem-details';
import { checkRateLimit, getClientIp } from '@/lib/api/rate-limit';
import { getHiscoresCache, getHiscoresCacheTtlMs } from '@/lib/cache/cache';
import { hiscoresModeToDbMode } from '@/lib/character/game-mode';
import { normalizeActivityScore } from '@/lib/character/normalize-activity-score';
import { getDbClient } from '@/lib/db';
import { importWiseOldManSnapshots } from '@/lib/integrations/wise-old-man-import';
import { logger } from '@/lib/logging/logger';
import { lookupPlayerWithAutoMode } from '@/lib/lookup/character-lookup';
import { AUTO_MODE_ORDER, resolveLookupMode } from '@/lib/lookup/lookup-mode';
import { buildSnapshotInsert } from '@/lib/snapshots/snapshots';

const lookupSchema = z.object({
  username: z
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
});

function normalizeHiscoresActivities<
  T extends { activities?: Array<{ key: string; score: number }> },
>(hiscores: T): T {
  if (!hiscores.activities || hiscores.activities.length === 0) {
    return hiscores;
  }

  const normalizedActivities = hiscores.activities.map((activity) => {
    const normalizedScore = normalizeActivityScore(
      activity.key,
      activity.score
    );
    if (normalizedScore === activity.score) {
      return activity;
    }
    return { ...activity, score: normalizedScore };
  });

  return { ...hiscores, activities: normalizedActivities };
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const usernameParam = searchParams.get('username');
  const modeParam = searchParams.get('mode');

  const parsed = lookupSchema.safeParse({
    username: usernameParam ?? '',
    mode: modeParam ?? 'auto',
  });

  if (!parsed.success) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid request',
      detail: 'Invalid username or mode.',
      errors: parsed.error.issues,
      instance: request.nextUrl.pathname,
    });

    return NextResponse.json(problem, { status: problem.status });
  }

  const resolvedMode = resolveLookupMode(parsed.data.mode);
  if (!resolvedMode) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid mode',
      detail: `Unsupported mode: ${parsed.data.mode}`,
      instance: request.nextUrl.pathname,
    });

    return NextResponse.json(problem, { status: problem.status });
  }

  const cache = getHiscoresCache();
  const cacheTtlMs = getHiscoresCacheTtlMs();

  const rateLimitId = `hiscores:${getClientIp(request)}`;
  const rateLimitResult = await checkRateLimit(rateLimitId);

  if (!rateLimitResult.success) {
    const problem = createProblemDetails({
      status: 429,
      title: 'Rate limit exceeded',
      detail: 'Too many requests. Please try again later.',
      instance: request.nextUrl.pathname,
    });

    const response = NextResponse.json(problem, { status: problem.status });
    return applyRateLimitHeaders(response, rateLimitResult);
  }

  try {
    const db = getDbClient();
    async function ensureProfileId(data: {
      displayName: string;
      mode: GameMode;
      capturedAt: string;
    }) {
      const dbMode = hiscoresModeToDbMode(data.mode);
      const [existing] = await db
        .select()
        .from(characterProfiles)
        .where(
          and(
            ilike(characterProfiles.displayName, data.displayName),
            eq(characterProfiles.mode, dbMode)
          )
        )
        .limit(1);

      if (existing) {
        return existing.id;
      }

      const [created] = await db
        .insert(characterProfiles)
        .values({
          displayName: data.displayName,
          mode: dbMode,
          lastSyncedAt: new Date(data.capturedAt),
        })
        .returning();

      return created?.id ?? null;
    }

    // Check cache for all modes if auto-mode
    if (resolvedMode === 'auto') {
      for (const mode of AUTO_MODE_ORDER) {
        const cacheKey = buildHiscoresCacheKey(parsed.data.username, mode);
        const cached = cache ? await cache.get(cacheKey) : null;
        if (cached) {
          const profileId = await ensureProfileId(cached);
          const response = NextResponse.json({
            data: normalizeHiscoresActivities(cached),
            meta: { cached: true, mode, profileId },
          });
          return applyRateLimitHeaders(response, rateLimitResult);
        }
      }
    } else {
      // Check cache for specific mode
      const cacheKey = buildHiscoresCacheKey(
        parsed.data.username,
        resolvedMode
      );
      const cached = cache ? await cache.get(cacheKey) : null;
      if (cached) {
        const profileId = await ensureProfileId(cached);
        const response = NextResponse.json({
          data: normalizeHiscoresActivities(cached),
          meta: { cached: true, mode: resolvedMode, profileId },
        });
        return applyRateLimitHeaders(response, rateLimitResult);
      }
    }

    // Cache miss - perform lookup
    const { resolvedMode: detectedMode, ...playerData } =
      await lookupPlayerWithAutoMode(parsed.data.username, resolvedMode, {
        strictHiscores: false,
      });

    // Cache the result
    if (cache) {
      const cacheKey = buildHiscoresCacheKey(
        parsed.data.username,
        detectedMode
      );
      await cache.set(cacheKey, playerData.hiscores, cacheTtlMs);
    }

    let profileId: string | null = null;

    // Opportunistic WOM backfill on lookup (non-user-facing)
    try {
      const dbMode = hiscoresModeToDbMode(playerData.hiscores.mode);
      const [existing] = await db
        .select()
        .from(characterProfiles)
        .where(
          and(
            ilike(
              characterProfiles.displayName,
              playerData.hiscores.displayName
            ),
            eq(characterProfiles.mode, dbMode)
          )
        )
        .limit(1);

      const profileRecord = existing
        ? existing
        : (
            await db
              .insert(characterProfiles)
              .values({
                displayName: playerData.hiscores.displayName,
                mode: dbMode,
                lastSyncedAt: new Date(playerData.hiscores.capturedAt),
              })
              .returning()
          )[0];

      if (profileRecord) {
        profileId = profileRecord.id;
        const [latestSnapshot] = await db
          .select({ capturedAt: characterSnapshots.capturedAt })
          .from(characterSnapshots)
          .where(eq(characterSnapshots.profileId, profileRecord.id))
          .orderBy(desc(characterSnapshots.capturedAt))
          .limit(1);

        const latestAt = latestSnapshot?.capturedAt?.getTime() ?? 0;
        const incomingAt = new Date(playerData.hiscores.capturedAt).getTime();
        const tenMinutes = 10 * 60 * 1000;

        if (!latestAt || incomingAt - latestAt > tenMinutes) {
          const snapshotInsert = buildSnapshotInsert(
            profileRecord.id,
            playerData.hiscores,
            playerData.source,
            playerData.warning,
            playerData.runelite
          );
          await db.insert(characterSnapshots).values(snapshotInsert);
        }

        await importWiseOldManSnapshots(db, profileRecord, {
          period: 'year',
          maxSnapshots: 200,
          requireEarlier: true,
        });
      }
    } catch (error) {
      logger.warn({ err: error }, 'Lookup WOM backfill skipped');
    }

    if (!profileId) {
      profileId = await ensureProfileId(playerData.hiscores);
    }

    const response = NextResponse.json({
      data: normalizeHiscoresActivities(playerData.hiscores),
      meta: {
        cached: false,
        mode: detectedMode,
        dataSource: playerData.source,
        dataSourceWarning: playerData.warning,
        profileId,
      },
    });
    return applyRateLimitHeaders(response, rateLimitResult);
  } catch (error) {
    logger.error({ err: error }, 'Character lookup error');
    return mapErrorToResponse(error, request.url);
  }
}
