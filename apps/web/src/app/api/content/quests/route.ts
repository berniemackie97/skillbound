import { NextResponse } from 'next/server';

import { createProblemDetails } from '@/lib/api/problem-details';
import { getLatestContentBundle } from '@/lib/content/content-bundles';

export async function GET() {
  try {
    const bundle = await getLatestContentBundle();
    return NextResponse.json({
      data: bundle.quests,
      contentVersion: bundle.metadata.version,
    });
  } catch (error) {
    console.error('Content bundle quests error:', error);
    const problem = createProblemDetails({
      status: 500,
      title: 'Content bundle error',
      detail: 'Unable to load quest data.',
    });

    return NextResponse.json(problem, { status: problem.status });
  }
}
