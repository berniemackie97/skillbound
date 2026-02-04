import { characterProfiles, eq } from '@skillbound/database';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createProblemDetails } from '@/lib/api/problem-details';
import { getDbClient } from '@/lib/db';
import { importWiseOldManSnapshots } from '@/lib/integrations/wise-old-man-import';

const paramsSchema = z.object({
  id: z.string().uuid(),
});

function resolveCronSecret(request: NextRequest): string | null {
  const headerSecret = request.headers.get('x-skillbound-cron-secret');
  if (headerSecret) {
    return headerSecret;
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return null;
  }

  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length).trim();
  }

  return null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id?: string }> }
) {
  const configuredSecret = process.env['CRON_SECRET']?.trim();
  const providedSecret = resolveCronSecret(request);

  if (configuredSecret && providedSecret !== configuredSecret) {
    const problem = createProblemDetails({
      status: 401,
      title: 'Unauthorized',
      detail: 'Missing or invalid cron secret.',
      instance: request.nextUrl.pathname,
    });

    return NextResponse.json(problem, { status: problem.status });
  }

  const resolvedParams = await params;
  const parsedParams = paramsSchema.safeParse(resolvedParams);
  if (!parsedParams.success) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid character id',
      detail: 'Character id must be a valid UUID.',
      errors: parsedParams.error.issues,
      instance: request.nextUrl.pathname,
    });

    return NextResponse.json(problem, { status: problem.status });
  }

  const db = getDbClient();
  const [character] = await db
    .select()
    .from(characterProfiles)
    .where(eq(characterProfiles.id, parsedParams.data.id))
    .limit(1);

  if (!character) {
    const problem = createProblemDetails({
      status: 404,
      title: 'Character not found',
      detail: 'No character exists for the supplied id.',
      instance: request.nextUrl.pathname,
    });

    return NextResponse.json(problem, { status: problem.status });
  }

  const result = await importWiseOldManSnapshots(db, character, {
    period: 'year',
    maxSnapshots: 200,
    requireEarlier: true,
  });

  return NextResponse.json({ characterId: character.id, result });
}
