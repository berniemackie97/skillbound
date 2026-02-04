import { NextResponse } from 'next/server';

import { createProblemDetails } from '@/lib/api/problem-details';
import { getLatestContentBundle } from '@/lib/content/content-bundles';

export async function GET() {
  try {
    const bundle = await getLatestContentBundle();
    const metadata = {
      ...bundle.metadata,
      questCount: bundle.metadata.questCount ?? bundle.quests.length,
      diaryCount: bundle.metadata.diaryCount ?? bundle.diaries.length,
      itemCount: bundle.metadata.itemCount ?? bundle.items?.length ?? 0,
    };

    return NextResponse.json({
      metadata,
      contentVersion: bundle.metadata.version,
    });
  } catch (error) {
    console.error('Content bundle metadata error:', error);
    const problem = createProblemDetails({
      status: 500,
      title: 'Content bundle error',
      detail: 'Unable to load content bundle metadata.',
    });

    return NextResponse.json(problem, { status: problem.status });
  }
}
