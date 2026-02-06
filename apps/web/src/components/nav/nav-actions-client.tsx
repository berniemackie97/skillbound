'use client';

import { useEffect, useState } from 'react';

import type { AuthProviderFlags } from '@/lib/auth/auth-providers';

import { NavActions } from './nav-actions';

type CharacterOption = {
  id: string;
  displayName: string;
  mode: string;
};

type NavSessionResponse = {
  user: { id: string; name?: string | null; email?: string | null } | null;
  characters: CharacterOption[];
  activeCharacterId: string | null;
};

type NavActionsClientProps = AuthProviderFlags & {
  signInAction: (
    provider: string,
    payload?: { identifier: string; password: string; callbackUrl?: string }
  ) => Promise<void>;
  signOutAction: () => Promise<void>;
  registerAction: (payload: {
    email: string;
    password: string;
    username?: string;
    callbackUrl?: string;
  }) => Promise<void>;
  magicLinkAction?:
    | ((payload: { email: string; callbackUrl?: string }) => Promise<void>)
    | undefined;
};

const emptySession: NavSessionResponse = {
  user: null,
  characters: [],
  activeCharacterId: null,
};

export function NavActionsClient({
  hasGoogle,
  hasGitHub,
  hasFacebook,
  hasTwitter,
  hasMagicLink,
  hasOAuth: _hasOAuth,
  signInAction,
  signOutAction,
  registerAction,
  magicLinkAction,
}: NavActionsClientProps) {
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

  const isSignedIn = Boolean(session.user?.id);

  return (
    <NavActions
      activeCharacterId={session.activeCharacterId}
      characters={session.characters}
      hasFacebook={hasFacebook}
      hasGitHub={hasGitHub}
      hasGoogle={hasGoogle}
      hasMagicLink={hasMagicLink}
      hasTwitter={hasTwitter}
      isSignedIn={isSignedIn}
      magicLinkAction={hasMagicLink ? magicLinkAction : undefined}
      registerAction={registerAction}
      signInAction={signInAction}
      signOutAction={signOutAction}
      userEmail={session.user?.email}
      userName={session.user?.name}
    />
  );
}
