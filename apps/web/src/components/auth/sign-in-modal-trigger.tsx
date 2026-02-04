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
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className={className}
        type="button"
        onClick={() => setIsOpen(true)}
      >
        {label}
      </button>
      {isOpen && (
        <AuthModal
          hasFacebook={hasFacebook}
          hasGitHub={hasGitHub}
          hasGoogle={hasGoogle}
          hasMagicLink={hasMagicLink}
          hasTwitter={hasTwitter}
          mode="signin"
          onClose={() => setIsOpen(false)}
          onRegister={registerAction}
          onSignIn={signInAction}
          {...(magicLinkAction ? { onMagicLink: magicLinkAction } : {})}
        />
      )}
    </>
  );
}
