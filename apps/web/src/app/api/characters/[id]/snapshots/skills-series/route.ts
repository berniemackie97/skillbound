import {
  and,
  characterSnapshots,
  eq,
  gte,
  lte,
  userCharacters,
} from '@skillbound/database';
import { isSkillName, SKILLS, type SkillName } from '@skillbound/domain';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getDbClient } from '@/lib/db';
import { createProblemDetails } from '@/lib/api/problem-details';
import { type SnapshotSeriesBucket } from '@/lib/snapshots/snapshot-buckets';
import { buildSkillSeries } from '@/lib/snapshots/snapshot-skill-series';

const paramsSchema = z.object({
  id: z.string().uuid(),
});

type RouteParams = Promise<{ id?: string }>;

const querySchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  bucket: z.enum(['day', 'week', 'month']).optional(),
  skills: z.string().optional(),
});

function parseSkills(input: string | undefined): SkillName[] | null {
  if (!input) {
    return null;
  }

  const values = input
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  if (values.length === 0) {
    return null;
  }

  const invalid = values.filter((value) => !isSkillName(value));
  if (invalid.length > 0) {
    return null;
  }

  return values as SkillName[];
}

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
    from: request.nextUrl.searchParams.get('from'),
    to: request.nextUrl.searchParams.get('to'),
    bucket: request.nextUrl.searchParams.get('bucket') ?? undefined,
    skills: request.nextUrl.searchParams.get('skills') ?? undefined,
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

  const bucket = (parsedQuery.data.bucket ?? 'day') as SnapshotSeriesBucket;
  const parsedSkills = parseSkills(parsedQuery.data.skills);

  if (parsedQuery.data.skills && !parsedSkills) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid skills list',
      detail: 'Provide a comma-separated list of valid skill names.',
    });

    return NextResponse.json(problem, { status: problem.status });
  }

  const skills = parsedSkills ?? [...SKILLS];

  const db = getDbClient();
  const [row] = await db
    .select({ profileId: userCharacters.profileId })
    .from(userCharacters)
    .where(eq(userCharacters.id, parsedParams.data.id))
    .limit(1);

  if (!row?.profileId) {
    const problem = createProblemDetails({
      status: 404,
      title: 'Character not found',
      detail: 'No character exists for the supplied id.',
    });

    return NextResponse.json(problem, { status: problem.status });
  }

  const snapshots = await db
    .select()
    .from(characterSnapshots)
    .where(
      and(
        eq(characterSnapshots.profileId, row.profileId),
        gte(characterSnapshots.capturedAt, new Date(parsedQuery.data.from)),
        lte(characterSnapshots.capturedAt, new Date(parsedQuery.data.to))
      )
    );

  const series = buildSkillSeries(snapshots, bucket, skills);

  return NextResponse.json({
    data: series.map((point) => ({
      bucketStart: point.bucketStart.toISOString(),
      snapshotId: point.snapshotId,
      capturedAt: point.capturedAt.toISOString(),
      skills: point.skills,
    })),
    meta: {
      bucket,
      count: series.length,
      skills,
    },
  });
}
