'use client';

import { useState } from 'react';

import { AuthModal } from '../auth/auth-modal';

import { useMobileMenu } from './mobile-menu';

type MobileMenuAuthProps = {
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

export function MobileMenuAuth({
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
}: MobileMenuAuthProps) {
  const [showModal, setShowModal] = useState<'signin' | 'signout' | null>(null);
  const menu = useMobileMenu();

  const openModal = (mode: 'signin' | 'signout') => {
    menu?.closeMenu();
    setShowModal(mode);
  };

  return (
    <div className="mobile-menu-section">
      <div className="mobile-menu-section-title">Account</div>
      <button
        className={`mobile-menu-action ${isSignedIn ? 'danger' : ''}`}
        type="button"
        onClick={() => openModal(isSignedIn ? 'signout' : 'signin')}
      >
        {isSignedIn ? 'Sign out' : 'Sign in'}
      </button>

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
    </div>
  );
}
