/**
 * GET /api/ge/game-events
 * POST /api/ge/game-events
 *
 * Manages game update events that impact market prices.
 * GET returns recent events; POST creates a new event (admin).
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createProblemDetails } from '@/lib/api/problem-details';
import { logger } from '@/lib/logging/logger';
import {
  createGameEvent,
  getGameEvents,
  getRecentEvents,
} from '@/lib/trading/game-events';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  eventType: z.enum([
    'game-update',
    'boss-release',
    'boss-nerf',
    'boss-buff',
    'item-nerf',
    'item-buff',
    'leagues',
    'deadman-mode',
    'holiday-event',
    'pvp-update',
    'economy-change',
    'other',
  ]),
  eventDate: z.coerce.date(),
  affectedItemIds: z.string().max(2000).optional(),
  sourceUrl: z.string().max(500).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const raw = {
      limit: request.nextUrl.searchParams.get('limit') ?? undefined,
      startDate: request.nextUrl.searchParams.get('startDate') ?? undefined,
      endDate: request.nextUrl.searchParams.get('endDate') ?? undefined,
    };

    const parsed = querySchema.safeParse(raw);
    if (!parsed.success) {
      const problem = createProblemDetails({
        status: 400,
        title: 'Invalid parameters',
        detail: 'Check query parameters.',
        errors: parsed.error.issues,
        instance: request.nextUrl.pathname,
      });
      return NextResponse.json(problem, { status: problem.status });
    }

    const { limit, startDate, endDate } = parsed.data;

    let events;
    if (startDate) {
      events = await getGameEvents(startDate, endDate ?? new Date());
    } else {
      events = await getRecentEvents(limit ?? 20);
    }

    return NextResponse.json({
      data: events,
      meta: { count: events.length },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to fetch game events');
    return NextResponse.json(
      { error: 'Failed to fetch game events' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    const parsed = createSchema.safeParse(body);

    if (!parsed.success) {
      const problem = createProblemDetails({
        status: 400,
        title: 'Invalid event data',
        detail: 'Check the request body.',
        errors: parsed.error.issues,
        instance: request.nextUrl.pathname,
      });
      return NextResponse.json(problem, { status: problem.status });
    }

    const event = await createGameEvent(parsed.data);

    return NextResponse.json({ data: event }, { status: 201 });
  } catch (error) {
    logger.error({ error }, 'Failed to create game event');
    return NextResponse.json(
      { error: 'Failed to create game event' },
      { status: 500 }
    );
  }
}
