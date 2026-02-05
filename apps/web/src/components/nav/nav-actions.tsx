'use client';

import Link from 'next/link';

import { AuthButtons } from '../auth/auth-buttons';
import { CharacterSwitcher } from '../characters/character-switcher';

type CharacterOption = {
  id: string;
  displayName: string;
  mode: string;
};

type NavActionsProps = {
  characters: CharacterOption[];
  activeCharacterId: string | null;
  isSignedIn: boolean;
  userEmail?: string | null | undefined;
  userName?: string | null | undefined;
  hasGoogle: boolean;
  hasGitHub: boolean;
  hasFacebook: boolean;
  hasTwitter: boolean;
  hasMagicLink: boolean;
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

export function NavActions({
  characters,
  activeCharacterId,
  isSignedIn,
  userEmail,
  userName,
  hasGoogle,
  hasGitHub,
  hasFacebook,
  hasTwitter,
  hasMagicLink,
  signInAction,
  signOutAction,
  registerAction,
  magicLinkAction,
}: NavActionsProps) {
  const hasCharacterSwitcher = isSignedIn && characters.length > 0;

  return (
    <div
      className={`nav-actions ${hasCharacterSwitcher ? 'has-character' : ''}`}
    >
      {hasCharacterSwitcher && (
        <CharacterSwitcher
          activeCharacterId={activeCharacterId}
          characters={characters}
        />
      )}
      <AuthButtons
        hasFacebook={hasFacebook}
        hasGitHub={hasGitHub}
        hasGoogle={hasGoogle}
        hasMagicLink={hasMagicLink}
        hasTwitter={hasTwitter}
        isSignedIn={isSignedIn}
        magicLinkAction={magicLinkAction}
        registerAction={registerAction}
        signInAction={signInAction}
        signOutAction={signOutAction}
        userEmail={userEmail}
        userName={userName}
      />
      <Link className="button nav-lookup" href="/lookup">
        New lookup
      </Link>
    </div>
  );
}
