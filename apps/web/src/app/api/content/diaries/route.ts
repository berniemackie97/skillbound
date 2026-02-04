import { NextResponse } from 'next/server';

import { getLatestContentBundle } from '@/lib/content/content-bundles';
import { createProblemDetails } from '@/lib/api/problem-details';

export async function GET() {
  try {
    const bundle = await getLatestContentBundle();
    return NextResponse.json({
      data: bundle.diaries,
      contentVersion: bundle.metadata.version,
    });
  } catch (error) {
    console.error('Content bundle diaries error:', error);
    const problem = createProblemDetails({
      status: 500,
      title: 'Content bundle error',
      detail: 'Unable to load diary data.',
    });

    return NextResponse.json(problem, { status: problem.status });
  }
}
