import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

import { NextResponse } from 'next/server';

import { createProblemDetails } from '@/lib/api/problem-details';
import {
  generateContentBundle,
  saveBundleRecord,
} from '@/lib/content/bundle-generator';
import { getDbClient } from '@/lib/db';

/**
 * Generate content bundle from database
 * POST /api/admin/content/generate
 *
 * This creates a new content bundle from the current database state:
 * 1. Query all quest/diary/achievement definitions
 * 2. Generate bundle JSON
 * 3. Save to filesystem (or S3 in production)
 * 4. Record in content_bundles table
 */
export async function POST() {
  try {
    const db = getDbClient();

    // Generate bundle from database
    const bundle = await generateContentBundle(db);

    // Save to filesystem (in production, upload to S3/R2)
    const publicDir = join(process.cwd(), 'public', 'content');
    await mkdir(publicDir, { recursive: true });

    const bundlePath = join(publicDir, 'latest-bundle.json');
    const bundleJson = JSON.stringify(bundle, null, 2);
    await writeFile(bundlePath, bundleJson, 'utf-8');

    // Also save versioned copy
    const versionedPath = join(
      publicDir,
      `bundle-${bundle.metadata.version}.json`
    );
    await writeFile(versionedPath, bundleJson, 'utf-8');

    // Save bundle record to database
    const storageUri = `/content/bundle-${bundle.metadata.version}.json`;
    await saveBundleRecord(db, bundle, storageUri);

    return NextResponse.json({
      success: true,
      bundle: {
        version: bundle.metadata.version,
        checksum: bundle.metadata.checksum,
        questCount: bundle.metadata.questCount,
        diaryCount: bundle.metadata.diaryCount,
        storageUri,
      },
    });
  } catch (error) {
    console.error('Bundle generation error:', error);
    const problem = createProblemDetails({
      status: 500,
      title: 'Bundle generation failed',
      detail:
        error instanceof Error ? error.message : 'Unable to generate bundle.',
    });

    return NextResponse.json(problem, { status: problem.status });
  }
}
