'use client';

import type { AuthProviderFlags } from '@/lib/auth/auth-providers';

import { NavActions } from './nav-actions';
import { useNavSession } from './nav-session-provider';

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
  const { session, isSignedIn } = useNavSession();

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
