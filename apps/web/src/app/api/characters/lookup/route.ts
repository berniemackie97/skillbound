import {
  createHiscoresClient,
  GameMode,
  HiscoresNotFoundError,
} from '@skillbound/hiscores';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const lookupSchema = z.object({
  username: z.string().min(1).max(12),
  mode: GameMode.optional().default('normal'),
});

const hiscoresClient = createHiscoresClient();

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const username = searchParams.get('username');
    const mode = searchParams.get('mode') ?? 'normal';

    const result = lookupSchema.safeParse({ username, mode });

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid parameters', details: result.error.issues },
        { status: 400 }
      );
    }

    const { username: validUsername, mode: validMode } = result.data;

    const hiscores = await hiscoresClient.lookup(validUsername, validMode);

    return NextResponse.json({
      success: true,
      data: hiscores,
    });
  } catch (error) {
    if (error instanceof HiscoresNotFoundError) {
      return NextResponse.json(
        { error: 'Character not found' },
        { status: 404 }
      );
    }

    console.error('Character lookup error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
