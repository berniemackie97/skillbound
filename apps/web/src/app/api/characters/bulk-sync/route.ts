import {
  and,
  characterProfiles,
  eq,
  sql,
  userCharacters,
} from '@skillbound/database';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getSessionUser, unauthorizedResponse } from '@/lib/auth/auth-helpers';
import { syncCharacter } from '@/lib/character/character-sync';
import { getDbClient } from '@/lib/db';
import { createProblemDetails } from '@/lib/api/problem-details';
import { checkRateLimit, getClientIp } from '@/lib/api/rate-limit';

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return unauthorizedResponse();
  }

  const rateLimitId = `characters:bulk-sync:${getClientIp(request)}`;
  const rateLimit = await checkRateLimit(rateLimitId);
  if (!rateLimit.success) {
    const problem = createProblemDetails({
      status: 429,
      title: 'Rate limit exceeded',
      detail: 'Too many requests. Please try again soon.',
    });
    return NextResponse.json(problem, { status: problem.status });
  }

  const db = getDbClient();
  const characters = await db
    .select({
      userCharacterId: userCharacters.id,
      profile: characterProfiles,
    })
    .from(userCharacters)
    .innerJoin(
      characterProfiles,
      eq(userCharacters.profileId, characterProfiles.id)
    )
    .where(
      and(
        eq(userCharacters.userId, user.id),
        sql`${userCharacters.archivedAt} IS NULL`
      )
    );

  if (characters.length === 0) {
    return NextResponse.json({
      data: { attempted: 0, captured: 0, failed: 0, skipped: 0 },
    });
  }

  let captured = 0;
  let failed = 0;

  for (const entry of characters) {
    try {
      await syncCharacter(db, entry.profile, {
        userCharacterId: entry.userCharacterId,
      });
      captured += 1;
    } catch {
      failed += 1;
    }
  }

  return NextResponse.json({
    data: {
      attempted: characters.length,
      captured,
      failed,
      skipped: 0,
    },
  });
}
