'use client';

import { useEffect, useMemo, useState } from 'react';

import type { LookupResponse } from '@/lib/lookup/lookup-types';
import { isCharacterSaved } from '@/lib/lookup/lookup-utils';

type NavSessionResponse = {
  user: { id: string; name?: string | null; email?: string | null } | null;
  characters: Array<{ id: string; displayName: string; mode: string }>;
  activeCharacterId: string | null;
};

const emptySession: NavSessionResponse = {
  user: null,
  characters: [],
  activeCharacterId: null,
};

type LookupActionsProps = {
  lookup: LookupResponse | null;
};

export function LookupActions({ lookup }: LookupActionsProps) {
  const [session, setSession] = useState<NavSessionResponse>(emptySession);

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
      }
    };

    void loadSession();
    return () => {
      active = false;
    };
  }, []);

  const saved = useMemo(() => {
    return isCharacterSaved({
      lookup,
      savedCharacters: session.characters,
    });
  }, [lookup, session.characters]);

  if (!lookup) {
    return null;
  }

  if (!session.user) {
    return (
      <a className="button ghost" href="/login">
        Sign in to save
      </a>
    );
  }

  if (saved) {
    return <span className="pill subtle">Saved</span>;
  }

  return (
    <form action="/api/characters" method="post">
      <input name="displayName" type="hidden" value={lookup.data.displayName} />
      <input name="mode" type="hidden" value={lookup.data.mode} />
      <button className="button" type="submit">
        Save character
      </button>
    </form>
  );
}
