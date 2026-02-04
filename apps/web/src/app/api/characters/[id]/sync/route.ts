import { characterProfiles, eq, userCharacters } from '@skillbound/database';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { mapErrorToResponse } from '@/lib/api/api-error-mapper';
import { applyRateLimitHeaders } from '@/lib/api/api-middleware';
import { createProblemDetails } from '@/lib/api/problem-details';
import { checkRateLimit, getClientIp } from '@/lib/api/rate-limit';
import { syncCharacter } from '@/lib/character/character-sync';
import { getDbClient } from '@/lib/db';
import { logger } from '@/lib/logging/logger';

const paramsSchema = z.object({
  id: z.string().uuid(),
});

type RouteParams = Promise<{ id?: string }>;

export async function POST(
  request: NextRequest,
  { params }: { params: RouteParams }
) {
  const resolvedParams = await params;
  const parsedParams = paramsSchema.safeParse(resolvedParams);
  if (!parsedParams.success) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid character id',
      detail: 'Character id must be a valid UUID.',
    });

    return NextResponse.json(problem, { status: problem.status });
  }

  const rateLimitId = `characters:sync:${getClientIp(request)}`;
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
    .where(eq(userCharacters.id, parsedParams.data.id))
    .limit(1);

  if (!row?.profile) {
    const problem = createProblemDetails({
      status: 404,
      title: 'Character not found',
      detail: 'No character exists for the supplied id.',
    });

    return NextResponse.json(problem, { status: problem.status });
  }

  try {
    const { snapshot, capturedAt } = await syncCharacter(db, row.profile, {
      userCharacterId: row.userCharacter.id,
    });

    return NextResponse.json({
      data: snapshot,
      capturedAt,
    });
  } catch (error) {
    logger.error({ err: error }, 'Character sync error');
    return mapErrorToResponse(error, request.url);
  }
}
