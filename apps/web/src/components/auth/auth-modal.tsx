'use client';

import { isRedirectError } from 'next/dist/client/components/redirect-error';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useId, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';

type AuthModalProps = {
  mode: 'signin' | 'signout';
  userEmail?: string | null | undefined;
  userName?: string | null | undefined;
  hasGoogle?: boolean | undefined;
  hasGitHub?: boolean | undefined;
  hasFacebook?: boolean | undefined;
  hasTwitter?: boolean | undefined;
  hasMagicLink?: boolean | undefined;
  onClose: () => void;
  onSignIn?:
    | ((
        provider: string,
        payload?: { identifier: string; password: string; callbackUrl?: string }
      ) => Promise<void>)
    | undefined;
  onSignOut?: (() => Promise<void>) | undefined;
  onRegister?:
    | ((payload: {
        email: string;
        password: string;
        username?: string;
        callbackUrl?: string;
      }) => Promise<void>)
    | undefined;
  onMagicLink?:
    | ((payload: { email: string; callbackUrl?: string }) => Promise<void>)
    | undefined;
};

export function AuthModal({
  mode,
  userEmail,
  userName,
  hasGoogle = false,
  hasGitHub = false,
  hasFacebook = false,
  hasTwitter = false,
  hasMagicLink = false,
  onClose,
  onSignIn,
  onSignOut,
  onRegister,
  onMagicLink,
}: AuthModalProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [view, setView] = useState<'signin' | 'register'>('signin');
  const [error, setError] = useState<string | null>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const titleId = useId();
  const subtitleId = useId();
  const descriptionId = useId();

  const hasOAuth = hasGoogle || hasGitHub || hasFacebook || hasTwitter;

  useEffect(() => {
    setPortalTarget(document.body);
  }, []);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (!portalTarget) return;
    const body = document.body;
    const shell = document.querySelector('.shell');
    const currentCount = Number(body.dataset['authModalCount'] ?? '0');
    const nextCount = currentCount + 1;
    body.dataset['authModalCount'] = String(nextCount);

    if (nextCount === 1) {
      body.dataset['authModalOverflow'] = body.style.overflow || '';
      body.style.overflow = 'hidden';
    }

    if (shell) {
      shell.setAttribute('inert', '');
      shell.setAttribute('aria-hidden', 'true');
    }

    return () => {
      const remainingCount = Math.max(
        0,
        Number(body.dataset['authModalCount'] ?? '1') - 1
      );
      body.dataset['authModalCount'] = String(remainingCount);

      if (remainingCount === 0) {
        body.style.overflow = body.dataset['authModalOverflow'] ?? '';
        delete body.dataset['authModalOverflow'];
        delete body.dataset['authModalCount'];
      }

      if (shell && remainingCount === 0) {
        shell.removeAttribute('inert');
        shell.removeAttribute('aria-hidden');
      }
    };
  }, [portalTarget]);

  const readFormValue = (formData: FormData, key: string): string => {
    const value = formData.get(key);
    return typeof value === 'string' ? value : '';
  };

  const handleCredentialsSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!onSignIn) return;

      setError(null);
      const formData = new FormData(e.currentTarget);
      const identifier = readFormValue(formData, 'identifier').trim();
      const password = readFormValue(formData, 'password');
      const callbackUrl =
        typeof window !== 'undefined'
          ? `${window.location.pathname}${window.location.search}`
          : '/';

      startTransition(async () => {
        try {
          await onSignIn('credentials', { identifier, password, callbackUrl });
          router.refresh();
          onClose();
        } catch (err) {
          if (isRedirectError(err)) throw err;
          setError('Invalid email or password.');
        }
      });
    },
    [onSignIn, onClose, router]
  );

  const handleRegisterSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!onRegister) return;

      setError(null);
      const formData = new FormData(e.currentTarget);
      const email = readFormValue(formData, 'email').trim();
      const password = readFormValue(formData, 'password');
      const usernameRaw = readFormValue(formData, 'username').trim();
      const username = usernameRaw.length > 0 ? usernameRaw : undefined;
      const callbackUrl =
        typeof window !== 'undefined'
          ? `${window.location.pathname}${window.location.search}`
          : '/';
      const payload =
        username !== undefined
          ? { email, password, username, callbackUrl }
          : { email, password, callbackUrl };

      startTransition(async () => {
        try {
          await onRegister(payload);
          router.refresh();
          onClose();
        } catch (err) {
          if (isRedirectError(err)) throw err;
          if (err instanceof Error && err.message === 'UserExists') {
            setError('An account with that email already exists.');
          } else {
            setError('Unable to create account. Please try again.');
          }
        }
      });
    },
    [onRegister, onClose, router]
  );

  const handleOAuthSubmit = useCallback(
    (provider: string) => {
      if (!onSignIn) return;
      startTransition(async () => {
        try {
          await onSignIn(provider);
        } catch (err) {
          if (isRedirectError(err)) throw err;
          setError('Unable to sign in. Please try again.');
        }
      });
    },
    [onSignIn]
  );

  const handleMagicLinkSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!onMagicLink) return;

      setError(null);
      const formData = new FormData(e.currentTarget);
      const email = readFormValue(formData, 'email').trim();
      const callbackUrl =
        typeof window !== 'undefined'
          ? `${window.location.pathname}${window.location.search}`
          : '/';

      startTransition(async () => {
        try {
          await onMagicLink({ email, callbackUrl });
        } catch (err) {
          if (isRedirectError(err)) throw err;
          setError('Unable to send magic link. Please try again.');
        }
      });
    },
    [onMagicLink]
  );

  const handleSignOut = useCallback(() => {
    if (!onSignOut) return;
    startTransition(async () => {
      try {
        await onSignOut();
        router.refresh();
        onClose();
      } catch (err) {
        if (isRedirectError(err)) throw err;
        setError('Unable to sign out. Please try again.');
      }
    });
  }, [onSignOut, onClose, router]);

  const modalContent =
    mode === 'signout' ? (
      <div className="modal-backdrop">
        <button
          aria-label="Close modal"
          className="modal-backdrop-button"
          type="button"
          onClick={onClose}
        />
        <div
          aria-describedby={`${subtitleId} ${descriptionId}`}
          aria-labelledby={titleId}
          aria-modal="true"
          className="modal-container modal-sm"
          role="dialog"
        >
          <button
            aria-label="Close modal"
            className="modal-close"
            type="button"
            onClick={onClose}
          >
            <svg
              fill="none"
              height="20"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
              width="20"
            >
              <line x1="18" x2="6" y1="6" y2="18" />
              <line x1="6" x2="18" y1="6" y2="18" />
            </svg>
          </button>

          <div className="modal-icon warning">
            <svg
              fill="none"
              height="28"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
              width="28"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16,17 21,12 16,7" />
              <line x1="21" x2="9" y1="12" y2="12" />
            </svg>
          </div>

          <h2 className="modal-title" id={titleId}>
            Sign out
          </h2>
          <p className="modal-subtitle" id={subtitleId}>
            Signed in as <strong>{userEmail ?? userName ?? 'Player'}</strong>
          </p>
          <p className="modal-description" id={descriptionId}>
            Are you sure you want to sign out?
          </p>

          {error && <div className="modal-error">{error}</div>}

          <div className="modal-actions">
            <button
              className="modal-btn danger"
              disabled={isPending}
              type="button"
              onClick={handleSignOut}
            >
              {isPending ? 'Signing out...' : 'Sign out'}
            </button>
            <button className="modal-btn ghost" type="button" onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    ) : (
      <div className="modal-backdrop">
        <button
          aria-label="Close modal"
          className="modal-backdrop-button"
          type="button"
          onClick={onClose}
        />
        <div
          aria-describedby={subtitleId}
          aria-labelledby={titleId}
          aria-modal="true"
          className="modal-container"
          role="dialog"
        >
          <button
            aria-label="Close modal"
            className="modal-close"
            type="button"
            onClick={onClose}
          >
            <svg
              fill="none"
              height="20"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
              width="20"
            >
              <line x1="18" x2="6" y1="6" y2="18" />
              <line x1="6" x2="18" y1="6" y2="18" />
            </svg>
          </button>

          <h2 className="modal-title" id={titleId}>
            {view === 'signin' ? 'Sign in' : 'Create account'}
          </h2>
          <p className="modal-subtitle" id={subtitleId}>
            {view === 'signin'
              ? 'Sign in to track characters and save progress.'
              : 'Create a free account to get started.'}
          </p>

          {error && <div className="modal-error">{error}</div>}

          {/* OAuth Providers */}
          {hasOAuth && (
            <div className="modal-oauth">
              {hasGoogle && (
                <button
                  className="modal-oauth-btn"
                  disabled={isPending}
                  type="button"
                  onClick={() => handleOAuthSubmit('google')}
                >
                  <svg height="18" viewBox="0 0 24 24" width="18">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  Continue with Google
                </button>
              )}
              {hasGitHub && (
                <button
                  className="modal-oauth-btn"
                  disabled={isPending}
                  type="button"
                  onClick={() => handleOAuthSubmit('github')}
                >
                  <svg
                    fill="currentColor"
                    height="18"
                    viewBox="0 0 24 24"
                    width="18"
                  >
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                  Continue with GitHub
                </button>
              )}
              {hasFacebook && (
                <button
                  className="modal-oauth-btn"
                  disabled={isPending}
                  type="button"
                  onClick={() => handleOAuthSubmit('facebook')}
                >
                  <svg
                    fill="#1877F2"
                    height="18"
                    viewBox="0 0 24 24"
                    width="18"
                  >
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                  Continue with Facebook
                </button>
              )}
              {hasTwitter && (
                <button
                  className="modal-oauth-btn"
                  disabled={isPending}
                  type="button"
                  onClick={() => handleOAuthSubmit('twitter')}
                >
                  <svg
                    fill="currentColor"
                    height="18"
                    viewBox="0 0 24 24"
                    width="18"
                  >
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                  Continue with X
                </button>
              )}
            </div>
          )}

          {hasOAuth && (
            <div className="modal-divider">
              <span>or</span>
            </div>
          )}

          {/* Email/Password Form */}
          {view === 'signin' ? (
            <form className="modal-form" onSubmit={handleCredentialsSubmit}>
              <div className="modal-input-group">
                <label htmlFor="modal-identifier">Email or username</label>
                <input
                  required
                  autoComplete="username"
                  id="modal-identifier"
                  name="identifier"
                  placeholder="you@example.com"
                  type="text"
                />
              </div>
              <div className="modal-input-group">
                <label htmlFor="modal-password">Password</label>
                <input
                  required
                  autoComplete="current-password"
                  id="modal-password"
                  name="password"
                  placeholder="Your password"
                  type="password"
                />
              </div>
              <button
                className="modal-btn primary"
                disabled={isPending}
                type="submit"
              >
                {isPending ? 'Signing in...' : 'Sign in'}
              </button>
            </form>
          ) : (
            <form className="modal-form" onSubmit={handleRegisterSubmit}>
              <div className="modal-input-group">
                <label htmlFor="modal-reg-username">Username (optional)</label>
                <input
                  autoComplete="off"
                  id="modal-reg-username"
                  name="username"
                  placeholder="Choose a display name"
                  type="text"
                />
              </div>
              <div className="modal-input-group">
                <label htmlFor="modal-reg-email">Email</label>
                <input
                  required
                  autoComplete="email"
                  id="modal-reg-email"
                  name="email"
                  placeholder="you@example.com"
                  type="email"
                />
              </div>
              <div className="modal-input-group">
                <label htmlFor="modal-reg-password">Password</label>
                <input
                  required
                  autoComplete="new-password"
                  id="modal-reg-password"
                  name="password"
                  placeholder="Create a password"
                  type="password"
                />
              </div>
              <button
                className="modal-btn primary"
                disabled={isPending}
                type="submit"
              >
                {isPending ? 'Creating account...' : 'Create account'}
              </button>
            </form>
          )}

          {/* Magic Link */}
          {hasMagicLink && view === 'signin' && (
            <>
              <div className="modal-divider">
                <span>or</span>
              </div>
              <form className="modal-form" onSubmit={handleMagicLinkSubmit}>
                <div className="modal-input-group">
                  <label htmlFor="modal-magic-email">
                    Email for magic link
                  </label>
                  <input
                    required
                    id="modal-magic-email"
                    name="email"
                    placeholder="you@example.com"
                    type="email"
                  />
                </div>
                <button
                  className="modal-btn secondary"
                  disabled={isPending}
                  type="submit"
                >
                  {isPending ? 'Sending...' : 'Email me a link'}
                </button>
              </form>
            </>
          )}

          {/* Toggle Sign in / Register */}
          <div className="modal-footer">
            {view === 'signin' ? (
              <p>
                New to Skillbound?{' '}
                <button
                  className="modal-link"
                  type="button"
                  onClick={() => setView('register')}
                >
                  Create account
                </button>
              </p>
            ) : (
              <p>
                Already have an account?{' '}
                <button
                  className="modal-link"
                  type="button"
                  onClick={() => setView('signin')}
                >
                  Sign in
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    );

  if (!portalTarget) {
    return null;
  }

  return createPortal(modalContent, portalTarget);
}
