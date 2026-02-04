'use client';

import { useState } from 'react';

import { AuthModal } from './auth-modal';

type SignInModalTriggerProps = {
  label?: string | undefined;
  className?: string | undefined;
  hasGoogle?: boolean | undefined;
  hasGitHub?: boolean | undefined;
  hasFacebook?: boolean | undefined;
  hasTwitter?: boolean | undefined;
  hasMagicLink?: boolean | undefined;
  signInAction: (provider: string, formData?: FormData) => Promise<void>;
  registerAction: (formData: FormData) => Promise<void>;
  magicLinkAction?: ((formData: FormData) => Promise<void>) | undefined;
};

export function SignInModalTrigger({
  label = 'Sign in',
  className = 'button ghost',
  hasGoogle = false,
  hasGitHub = false,
  hasFacebook = false,
  hasTwitter = false,
  hasMagicLink = false,
  signInAction,
  registerAction,
  magicLinkAction,
}: SignInModalTriggerProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        className={className}
        onClick={() => setIsOpen(true)}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        {label}
      </button>
      {isOpen && (
        <AuthModal
          mode="signin"
          hasGoogle={hasGoogle}
          hasGitHub={hasGitHub}
          hasFacebook={hasFacebook}
          hasTwitter={hasTwitter}
          hasMagicLink={hasMagicLink}
          onClose={() => setIsOpen(false)}
          onSignIn={signInAction}
          onRegister={registerAction}
          {...(magicLinkAction ? { onMagicLink: magicLinkAction } : {})}
        />
      )}
    </>
  );
}
