'use client';

import { useState } from 'react';

import { AuthModal } from './auth-modal';

type AuthButtonsProps = {
  isSignedIn: boolean;
  userEmail?: string | null | undefined;
  userName?: string | null | undefined;
  hasGoogle?: boolean | undefined;
  hasGitHub?: boolean | undefined;
  hasFacebook?: boolean | undefined;
  hasTwitter?: boolean | undefined;
  hasMagicLink?: boolean | undefined;
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

export function AuthButtons({
  isSignedIn,
  userEmail,
  userName,
  hasGoogle = false,
  hasGitHub = false,
  hasFacebook = false,
  hasTwitter = false,
  hasMagicLink = false,
  signInAction,
  signOutAction,
  registerAction,
  magicLinkAction,
}: AuthButtonsProps) {
  const [showModal, setShowModal] = useState<'signin' | 'signout' | null>(null);

  return (
    <>
      {isSignedIn ? (
        <button
          className="button ghost"
          type="button"
          onClick={() => setShowModal('signout')}
        >
          Sign out
        </button>
      ) : (
        <button
          className="button ghost"
          type="button"
          onClick={() => setShowModal('signin')}
        >
          Sign in
        </button>
      )}

      {showModal === 'signin' && (
        <AuthModal
          hasFacebook={hasFacebook}
          hasGitHub={hasGitHub}
          hasGoogle={hasGoogle}
          hasMagicLink={hasMagicLink}
          hasTwitter={hasTwitter}
          mode="signin"
          onClose={() => setShowModal(null)}
          onRegister={registerAction}
          onSignIn={signInAction}
          {...(magicLinkAction ? { onMagicLink: magicLinkAction } : {})}
        />
      )}

      {showModal === 'signout' && (
        <AuthModal
          mode="signout"
          userEmail={userEmail}
          userName={userName}
          onClose={() => setShowModal(null)}
          onSignOut={signOutAction}
        />
      )}
    </>
  );
}
