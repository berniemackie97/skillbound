import {
  HiscoresNotFoundError,
  HiscoresRateLimitError,
  HiscoresServerError,
  RuneLiteAPIError,
} from '@skillbound/hiscores';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

import { logger } from '../logging/logger';

import { createProblemDetails, type ProblemDetails } from './problem-details';

/**
 * Maps known error types to HTTP problem details responses
 * Provides consistent error handling across all API routes
 */
export function mapErrorToResponse(
  error: unknown,
  instance?: string
): NextResponse<ProblemDetails> {
  // Hiscores Not Found (404)
  if (error instanceof HiscoresNotFoundError) {
    const problem = createProblemDetails({
      status: 404,
      title: 'Character not found',
      detail: error.message,
      ...(instance && { instance }),
    });
    return NextResponse.json(problem, { status: 404 });
  }

  // Hiscores Rate Limit (429)
  if (error instanceof HiscoresRateLimitError) {
    const problem = createProblemDetails({
      status: 429,
      title: 'Rate limit exceeded',
      detail:
        'The OSRS Hiscores API is rate limiting requests. Please try again later.',
      ...(instance && { instance }),
    });
    return NextResponse.json(problem, { status: 429 });
  }

  // Hiscores Server Error (503)
  if (error instanceof HiscoresServerError) {
    const problem = createProblemDetails({
      status: 503,
      title: 'Hiscores service unavailable',
      detail:
        'The OSRS Hiscores service is temporarily unavailable. Please try again later.',
      ...(instance && { instance }),
    });
    return NextResponse.json(problem, { status: 503 });
  }

  // RuneLite API Error (502)
  // RuneLite API Error (502)
  if (error instanceof RuneLiteAPIError) {
    const problem = createProblemDetails({
      status: 502,
      title: 'External API error',
      detail: error.message,
      ...(instance && { instance }),
    });
    return NextResponse.json(problem, { status: 502 });
  }

  // Zod Validation Error (400)
  if (error instanceof ZodError) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Validation error',
      detail: 'Invalid request parameters',
      errors: error.issues,
      ...(instance && { instance }),
    });
    return NextResponse.json(problem, { status: 400 });
  }

  // Generic Error (500)
  logger.error({ err: error, instance }, 'Unexpected API error');

  const problem = createProblemDetails({
    status: 500,
    title: 'Internal server error',
    detail:
      error instanceof Error ? error.message : 'An unexpected error occurred',
    ...(instance && { instance }),
  });

  return NextResponse.json(problem, { status: 500 });
}

/**
 * Async error handler wrapper for API routes
 * Usage: export const GET = withErrorHandling(async (request) => { ... })
 */
export function withErrorHandling(
  handler: (request: Request) => Promise<NextResponse>
) {
  return async (request: Request): Promise<NextResponse> => {
    try {
      return await handler(request);
    } catch (error) {
      return mapErrorToResponse(error, request.url);
    }
  };
}
