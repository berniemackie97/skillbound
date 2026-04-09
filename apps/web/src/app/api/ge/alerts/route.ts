/**
 * GET /api/ge/alerts
 * PUT /api/ge/alerts (mark read)
 *
 * Authenticated endpoint for managing price alerts.
 * GET returns unread alerts for the active character.
 * PUT marks alerts as read.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createProblemDetails } from '@/lib/api/problem-details';
import { getSessionUser, unauthorizedResponse } from '@/lib/auth/auth-helpers';
import { getTradableCharacters } from '@/lib/character/character-selection';
import {
  countUnreadAlerts,
  getUnreadAlerts,
  markAlertsRead,
  markAllAlertsRead,
} from '@/lib/trading/alerts';

export const dynamic = 'force-dynamic';

const markReadSchema = z.object({
  alertIds: z.array(z.string().uuid()).optional(),
  markAllRead: z.boolean().optional(),
});

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorizedResponse();

  const tradable = await getTradableCharacters(user.id);
  const first = tradable[0];
  if (!first) {
    return NextResponse.json({
      data: { alerts: [], unreadCount: 0 },
    });
  }

  const [alerts, unreadCount] = await Promise.all([
    getUnreadAlerts(first.id),
    countUnreadAlerts(first.id),
  ]);

  return NextResponse.json(
    {
      data: { alerts, unreadCount },
    },
    {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    }
  );
}

export async function PUT(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorizedResponse();

  const tradable = await getTradableCharacters(user.id);
  const first = tradable[0];
  if (!first) {
    return NextResponse.json(
      { error: 'No tradable character found' },
      { status: 404 }
    );
  }

  const body: unknown = await request.json();
  const parsed = markReadSchema.safeParse(body);

  if (!parsed.success) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid request',
      detail: 'Provide alertIds array or markAllRead flag.',
      errors: parsed.error.issues,
      instance: request.nextUrl.pathname,
    });
    return NextResponse.json(problem, { status: problem.status });
  }

  if (parsed.data.markAllRead) {
    await markAllAlertsRead(first.id);
  } else if (parsed.data.alertIds && parsed.data.alertIds.length > 0) {
    await markAlertsRead(parsed.data.alertIds);
  }

  const unreadCount = await countUnreadAlerts(first.id);

  return NextResponse.json({
    data: { unreadCount },
  });
}
