import { NextResponse } from 'next/server';

import { getSessionUser, unauthorizedResponse } from '@/lib/auth/auth-helpers';
import {
  getActiveCharacter,
  getUserCharacters,
} from '@/lib/character/character-selection';

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return unauthorizedResponse();
  }

  const [characters, activeSelection] = await Promise.all([
    getUserCharacters(user.id),
    getActiveCharacter(user.id),
  ]);

  return NextResponse.json({
    data: characters,
    activeCharacterId: activeSelection.character?.id ?? null,
  });
}
