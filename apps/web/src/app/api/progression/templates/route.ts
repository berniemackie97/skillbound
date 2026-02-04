import { PROGRESSION_CATEGORIES } from '@skillbound/database';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { mapErrorToResponse } from '@/lib/api/api-error-mapper';
import { logger } from '@/lib/logging/logger';

/**
 * GET /api/progression/templates
 * Get all available progression templates (ironman defaults, etc.)
 */
export function GET(request: NextRequest) {
  try {
    logger.info('Fetching progression templates');

    return NextResponse.json({
      data: {
        templates: [
          {
            id: 'ironman-essentials',
            name: 'Ironman Essentials',
            description:
              'Comprehensive ironman progression checklist with all major milestones',
            categories: PROGRESSION_CATEGORIES,
          },
        ],
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Get progression templates error');
    return mapErrorToResponse(error, request.url);
  }
}
