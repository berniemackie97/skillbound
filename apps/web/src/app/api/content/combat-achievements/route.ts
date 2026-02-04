import { NextResponse } from 'next/server';

import { getLatestContentBundle } from '@/lib/content/content-bundles';

export async function GET() {
  const bundle = await getLatestContentBundle();

  return NextResponse.json({
    data: bundle.combatAchievements,
    contentVersion: bundle.metadata.version,
  });
}
