'use client';

import { useEffect, useMemo, useState } from 'react';

import { ComprehensiveProgression } from './comprehensive-progression';
import { ProgressionBrowser } from './progression-browser';

type NavSessionResponse = {
  user: { id: string; name?: string | null; email?: string | null } | null;
  characters: Array<{ id: string; displayName: string; mode: string }>;
  activeCharacterId: string | null;
};

type ProgressionPageClientProps = {
  initialUsername: string;
  initialMode: string;
};

const emptySession: NavSessionResponse = {
  user: null,
  characters: [],
  activeCharacterId: null,
};

export function ProgressionPageClient({
  initialUsername,
  initialMode,
}: ProgressionPageClientProps) {
  const [session, setSession] = useState<NavSessionResponse>(emptySession);
  const [isLoadingSession, setIsLoadingSession] = useState(true);

  useEffect(() => {
    let active = true;

    const loadSession = async () => {
      try {
        const response = await fetch('/api/nav/session', {
          cache: 'no-store',
        });
        if (!response.ok) {
          if (active) setSession(emptySession);
          return;
        }
        const payload = (await response.json()) as NavSessionResponse;
        if (active) {
          setSession({
            user: payload.user ?? null,
            characters: payload.characters ?? [],
            activeCharacterId: payload.activeCharacterId ?? null,
          });
        }
      } catch {
        if (active) setSession(emptySession);
      } finally {
        if (active) setIsLoadingSession(false);
      }
    };

    void loadSession();
    return () => {
      active = false;
    };
  }, []);

  const activeCharacter = useMemo(() => {
    if (!session.activeCharacterId) return null;
    return (
      session.characters.find(
        (character) => character.id === session.activeCharacterId
      ) ?? null
    );
  }, [session.activeCharacterId, session.characters]);

  if (activeCharacter) {
    return (
      <ComprehensiveProgression
        characterId={activeCharacter.id}
        characterName={activeCharacter.displayName}
      />
    );
  }

  const isSignedIn = Boolean(session.user?.id) && !isLoadingSession;
  const hasActiveCharacter = Boolean(activeCharacter);

  return (
    <ProgressionBrowser
      hasActiveCharacter={hasActiveCharacter}
      initialMode={initialMode}
      initialUsername={initialUsername}
      signedIn={isSignedIn}
    />
  );
}
