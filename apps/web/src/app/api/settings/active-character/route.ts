import { eq, userSettings } from '@skillbound/database';
import { NextResponse } from 'next/server';

import { getSessionUser, unauthorizedResponse } from '@/lib/auth/auth-helpers';
import { getDbClient } from '@/lib/db';

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorizedResponse();

  const db = getDbClient();
  const [settings] = await db
    .select({ activeCharacterId: userSettings.activeCharacterId })
    .from(userSettings)
    .where(eq(userSettings.userId, user.id))
    .limit(1);

  return NextResponse.json({
    data: { activeCharacterId: settings?.activeCharacterId ?? null },
  });
}
