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
  signInAction: (provider: string, formData?: FormData) => Promise<void>;
  signOutAction: () => Promise<void>;
  registerAction: (formData: FormData) => Promise<void>;
  magicLinkAction?: ((formData: FormData) => Promise<void>) | undefined;
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
          onClick={() => setShowModal('signout')}
          type="button"
        >
          Sign out
        </button>
      ) : (
        <button
          className="button ghost"
          onClick={() => setShowModal('signin')}
          type="button"
        >
          Sign in
        </button>
      )}

      {showModal === 'signin' && (
        <AuthModal
          mode="signin"
          hasGoogle={hasGoogle}
          hasGitHub={hasGitHub}
          hasFacebook={hasFacebook}
          hasTwitter={hasTwitter}
          hasMagicLink={hasMagicLink}
          onClose={() => setShowModal(null)}
          onSignIn={signInAction}
          onRegister={registerAction}
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
