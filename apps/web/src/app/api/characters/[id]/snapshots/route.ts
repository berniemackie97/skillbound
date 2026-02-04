import {
  and,
  asc,
  characterProfiles,
  characterSnapshots,
  eq,
  gte,
  lte,
  userCharacters,
} from '@skillbound/database';
import { GameMode } from '@skillbound/hiscores';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createProblemDetails } from '@/lib/api/problem-details';
import { getHiscoresClient } from '@/lib/character/hiscores-client';
import { getDbClient } from '@/lib/db';
import { buildSnapshotInsert } from '@/lib/snapshots/snapshots';

const paramsSchema = z.object({
  id: z.string().uuid(),
});

type RouteParams = Promise<{ id?: string }>;

const querySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export async function GET(
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

  const parsedQuery = querySchema.safeParse({
    from: request.nextUrl.searchParams.get('from') ?? undefined,
    to: request.nextUrl.searchParams.get('to') ?? undefined,
  });

  if (!parsedQuery.success) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid range parameters',
      detail: 'from/to must be valid ISO datetimes.',
      errors: parsedQuery.error.issues,
    });

    return NextResponse.json(problem, { status: problem.status });
  }

  const db = getDbClient();
  const [profileRow] = await db
    .select({ profileId: userCharacters.profileId })
    .from(userCharacters)
    .where(eq(userCharacters.id, parsedParams.data.id))
    .limit(1);

  if (!profileRow) {
    const problem = createProblemDetails({
      status: 404,
      title: 'Character not found',
      detail: 'No character exists for the supplied id.',
    });

    return NextResponse.json(problem, { status: problem.status });
  }

  const conditions = [
    eq(characterSnapshots.profileId, profileRow.profileId),
  ];

  if (parsedQuery.data.from) {
    conditions.push(
      gte(characterSnapshots.capturedAt, new Date(parsedQuery.data.from))
    );
  }

  if (parsedQuery.data.to) {
    conditions.push(
      lte(characterSnapshots.capturedAt, new Date(parsedQuery.data.to))
    );
  }

  const whereClause =
    conditions.length === 1 ? conditions[0] : and(...conditions);

  const snapshots = await db
    .select()
    .from(characterSnapshots)
    .where(whereClause)
    .orderBy(asc(characterSnapshots.capturedAt));

  return NextResponse.json({
    data: snapshots,
  });
}

export async function POST(
  _request: NextRequest,
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

  const db = getDbClient();
  const [characterRow] = await db
    .select({
      profile: characterProfiles,
    })
    .from(userCharacters)
    .innerJoin(
      characterProfiles,
      eq(userCharacters.profileId, characterProfiles.id)
    )
    .where(eq(userCharacters.id, parsedParams.data.id))
    .limit(1);

  if (!characterRow?.profile) {
    const problem = createProblemDetails({
      status: 404,
      title: 'Character not found',
      detail: 'No character exists for the supplied id.',
    });

    return NextResponse.json(problem, { status: problem.status });
  }

  const modeParse = GameMode.safeParse(characterRow.profile.mode);
  if (!modeParse.success) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid character mode',
      detail: 'Character mode is not supported by hiscores.',
    });

    return NextResponse.json(problem, { status: problem.status });
  }

  try {
    const hiscores = await getHiscoresClient().lookup(
      characterRow.profile.displayName,
      modeParse.data
    );

    const snapshotInsert = buildSnapshotInsert(
      characterRow.profile.id,
      hiscores
    );
    const [snapshot] = await db
      .insert(characterSnapshots)
      .values(snapshotInsert)
      .returning();

    await db
      .update(characterProfiles)
      .set({ lastSyncedAt: new Date(hiscores.capturedAt) })
      .where(eq(characterProfiles.id, characterRow.profile.id));

    return NextResponse.json({
      data: snapshot,
    });
  } catch (error) {
    console.error('Snapshot capture error:', error);
    const problem = createProblemDetails({
      status: 500,
      title: 'Snapshot capture failed',
      detail: 'Unable to capture snapshot from hiscores.',
    });

    return NextResponse.json(problem, { status: problem.status });
  }
}
