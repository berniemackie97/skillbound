'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type NavCharacterOption = {
  id: string;
  displayName: string;
  mode: string;
};

export type NavSessionResponse = {
  user: { id: string; name?: string | null; email?: string | null } | null;
  characters: NavCharacterOption[];
  activeCharacterId: string | null;
};

type NavSessionState = {
  session: NavSessionResponse;
  isSignedIn: boolean;
  isLoading: boolean;
};

const emptySession: NavSessionResponse = {
  user: null,
  characters: [],
  activeCharacterId: null,
};

const NavSessionContext = createContext<NavSessionState | null>(null);

type NavSessionProviderProps = {
  children: ReactNode;
};

export function NavSessionProvider({ children }: NavSessionProviderProps) {
  const [session, setSession] = useState<NavSessionResponse>(emptySession);
  const [isLoading, setIsLoading] = useState(true);

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
        if (active) setIsLoading(false);
      }
    };

    void loadSession();
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<NavSessionState>(() => {
    return {
      session,
      isSignedIn: Boolean(session.user?.id),
      isLoading,
    };
  }, [session, isLoading]);

  return (
    <NavSessionContext.Provider value={value}>
      {children}
    </NavSessionContext.Provider>
  );
}

export function useNavSession() {
  const context = useContext(NavSessionContext);
  if (!context) {
    throw new Error('useNavSession must be used within NavSessionProvider');
  }
  return context;
}
