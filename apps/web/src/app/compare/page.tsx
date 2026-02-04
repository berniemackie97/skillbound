import { redirect } from 'next/navigation';

import { CompareSandbox } from '@/components/compare/compare-sandbox';
import { getSessionUser } from '@/lib/auth/auth-helpers';
import {
  getActiveCharacter,
  getUserCharacters,
} from '@/lib/character/character-selection';

export default async function ComparePage() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    redirect('/login?redirect=/compare');
  }

  const [characters, activeSelection] = await Promise.all([
    getUserCharacters(sessionUser.id),
    getActiveCharacter(sessionUser.id),
  ]);
  const activeCharacterId = activeSelection?.character?.id ?? null;

  const roster = characters.map((character) => ({
    id: character.id,
    displayName: character.displayName,
    mode: character.mode,
    lastSyncedAt: character.lastSyncedAt
      ? character.lastSyncedAt.toISOString()
      : null,
  }));

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Compare characters</h2>
          <p>
            Compare snapshot baselines for multiple characters. Pick your roster
            and see totals side-by-side.
          </p>
        </div>
      </div>
      <CompareSandbox
        activeCharacterId={activeCharacterId}
        characters={roster}
      />
    </section>
  );
}
