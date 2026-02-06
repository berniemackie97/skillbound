import { NextResponse } from 'next/server';

import { getSessionUser } from '@/lib/auth/auth-helpers';
import {
  getActiveCharacter,
  getUserCharacters,
} from '@/lib/character/character-selection';

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    const response = NextResponse.json({
      user: null,
      characters: [],
      activeCharacterId: null,
    });
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    return response;
  }

  const [characters, activeSelection] = await Promise.all([
    getUserCharacters(user.id),
    getActiveCharacter(user.id),
  ]);

  const response = NextResponse.json({
    user: {
      id: user.id,
      name: user.name ?? null,
      email: user.email ?? null,
    },
    characters: characters.map((character) => ({
      id: character.id,
      displayName: character.displayName,
      mode: character.mode,
    })),
    activeCharacterId: activeSelection.character?.id ?? null,
  });
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  return response;
}
