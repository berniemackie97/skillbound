import { eq, snapshotArchives } from '@skillbound/database';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createProblemDetails } from '@/lib/api/problem-details';
import { getDbClient } from '@/lib/db';
import { getSnapshotArchiveDownloadUrl } from '@/lib/snapshots/snapshot-archives';

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

type RouteParams = Promise<{ id?: string }>;

export async function GET(
  request: NextRequest,
  { params }: { params: RouteParams }
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
      title: 'Invalid archive id',
      detail: 'Archive id must be a valid UUID.',
      instance: request.nextUrl.pathname,
    });

    return NextResponse.json(problem, { status: problem.status });
  }

  const db = getDbClient();
  const [archive] = await db
    .select()
    .from(snapshotArchives)
    .where(eq(snapshotArchives.id, parsedParams.data.id))
    .limit(1);

  if (!archive) {
    const problem = createProblemDetails({
      status: 404,
      title: 'Archive not found',
      detail: 'No snapshot archive exists for the supplied id.',
      instance: request.nextUrl.pathname,
    });

    return NextResponse.json(problem, { status: problem.status });
  }

  const downloadRequested =
    request.nextUrl.searchParams.get('download')?.toLowerCase() === 'true';

  const downloadUrl = downloadRequested
    ? await getSnapshotArchiveDownloadUrl(archive)
    : null;

  return NextResponse.json({
    data: archive,
    meta: {
      downloadUrl,
    },
  });
}
