import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import {
  generateContentBundle,
  saveBundleRecord,
} from '@/lib/content/bundle-generator';
import { invalidateContentBundleCache } from '@/lib/content/content-bundles';
import { getDbClient } from '@/lib/db';
import { createProblemDetails } from '@/lib/api/problem-details';
import {
  syncAllFromWiki,
  syncCombatAchievements,
  syncQuests,
} from '@/lib/wiki/wiki-sync';

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

/**
 * POST /api/admin/content/sync
 *
 * Query params:
 * - type: combat | quests | all (default: combat)
 */
export async function POST(request: NextRequest) {
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

  const typeParam = request.nextUrl.searchParams.get('type')?.toLowerCase();
  const type = typeParam && ['combat', 'quests', 'all'].includes(typeParam)
    ? typeParam
    : 'combat';

  try {
    const db = getDbClient();

    let results;
    if (type === 'all') {
      results = await syncAllFromWiki(db);
    } else if (type === 'quests') {
      results = await syncQuests(db);
    } else {
      results = await syncCombatAchievements(db);
    }

    const bundle = await generateContentBundle(db);
    const publicDir = join(process.cwd(), 'public', 'content');
    await mkdir(publicDir, { recursive: true });

    const bundlePath = join(publicDir, 'latest-bundle.json');
    const bundleJson = JSON.stringify(bundle, null, 2);
    await writeFile(bundlePath, bundleJson, 'utf-8');

    const versionedPath = join(
      publicDir,
      `bundle-${bundle.metadata.version}.json`
    );
    await writeFile(versionedPath, bundleJson, 'utf-8');

    const storageUri = `/content/bundle-${bundle.metadata.version}.json`;
    await saveBundleRecord(db, bundle, storageUri);

    invalidateContentBundleCache();

    return NextResponse.json({
      success: true,
      type,
      results,
      bundle: {
        version: bundle.metadata.version,
        checksum: bundle.metadata.checksum,
        questCount: bundle.metadata.questCount,
        diaryCount: bundle.metadata.diaryCount,
        storageUri,
      },
    });
  } catch (error) {
    const problem = createProblemDetails({
      status: 500,
      title: 'Content sync failed',
      detail:
        error instanceof Error ? error.message : 'Unable to sync content.',
      instance: request.nextUrl.pathname,
    });

    return NextResponse.json(problem, { status: problem.status });
  }
}
