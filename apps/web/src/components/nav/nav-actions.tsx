'use client';

import Link from 'next/link';

import { CharacterSwitcher } from '../characters/character-switcher';
import { AuthButtons } from '../auth/auth-buttons';

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
  signInAction: (provider: string, formData?: FormData) => Promise<void>;
  signOutAction: () => Promise<void>;
  registerAction: (formData: FormData) => Promise<void>;
  magicLinkAction?: ((formData: FormData) => Promise<void>) | undefined;
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
  return (
    <div className="nav-actions">
      {isSignedIn && characters.length > 0 && (
        <CharacterSwitcher
          characters={characters}
          activeCharacterId={activeCharacterId}
        />
      )}
      <AuthButtons
        isSignedIn={isSignedIn}
        userEmail={userEmail}
        userName={userName}
        hasGoogle={hasGoogle}
        hasGitHub={hasGitHub}
        hasFacebook={hasFacebook}
        hasTwitter={hasTwitter}
        hasMagicLink={hasMagicLink}
        signInAction={signInAction}
        signOutAction={signOutAction}
        registerAction={registerAction}
        magicLinkAction={magicLinkAction}
      />
      <Link className="button" href="/lookup">
        New lookup
      </Link>
    </div>
  );
}
