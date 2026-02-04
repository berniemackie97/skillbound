import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createProblemDetails } from '@/lib/api/problem-details';
import { restoreSnapshotArchive } from '@/lib/snapshots/snapshot-archives';

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

function parseBooleanParam(value: string | null): boolean | null {
  if (value === null) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'y'].includes(normalized)) {
    return true;
  }
  if (['false', '0', 'no', 'n'].includes(normalized)) {
    return false;
  }
  return null;
}

type RouteParams = Promise<{ id?: string }>;

export async function POST(
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

  const dryRunValue = parseBooleanParam(
    request.nextUrl.searchParams.get('dryRun')
  );

  if (request.nextUrl.searchParams.has('dryRun') && dryRunValue === null) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid dryRun flag',
      detail: 'dryRun must be true or false.',
      instance: request.nextUrl.pathname,
    });

    return NextResponse.json(problem, { status: problem.status });
  }

  try {
    const result = await restoreSnapshotArchive(parsedParams.data.id, {
      dryRun: dryRunValue ?? false,
    });

    return NextResponse.json({
      data: result,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    const problem = createProblemDetails({
      status: 500,
      title: 'Snapshot archive restore failed',
      detail: errorMessage,
      instance: request.nextUrl.pathname,
    });

    return NextResponse.json(problem, { status: problem.status });
  }
}
