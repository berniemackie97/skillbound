import { progressionCategories } from '@skillbound/database';
import { NextResponse } from 'next/server';

import { createProblemDetails } from '@/lib/api/problem-details';
import { getDbClient } from '@/lib/db';

/**
 * GET /api/progression/categories
 * Retrieves all progression categories with their default items
 */
export async function GET() {
  try {
    const db = getDbClient();

    const categories = await db
      .select()
      .from(progressionCategories)
      .orderBy(progressionCategories.orderIndex, progressionCategories.name);

    return NextResponse.json({
      data: categories,
      meta: {
        count: categories.length,
      },
    });
  } catch (error) {
    const problem = createProblemDetails({
      status: 500,
      title: 'Failed to fetch progression categories',
      detail: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(problem, { status: problem.status });
  }
}
