import Link from 'next/link';
import { redirect } from 'next/navigation';

import { auth, signIn } from '@/lib/auth/auth';
import { registerUserWithPassword } from '@/lib/auth/auth-credentials';
import { buildPageMetadata } from '@/lib/seo/metadata';

export const metadata = buildPageMetadata({
  title: 'Sign In',
  description:
    'Sign in to manage your OSRS characters, progression tracking, and saved guides.',
  canonicalPath: '/login',
  noIndex: true,
});

type SearchParams = Promise<{
  error?: string | string[];
  callbackUrl?: string | string[];
}>;

function getStringParam(value: string | string[] | undefined) {
  if (!value) {
    return '';
  }
  return Array.isArray(value) ? (value[0] ?? '') : value;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const resolvedSearchParams = await searchParams;
  const session = await auth();
  const errorCode = getStringParam(resolvedSearchParams?.error);
  const callbackUrl =
    getStringParam(resolvedSearchParams?.callbackUrl) || '/characters';

  async function handleGoogleSignIn() {
    'use server';
    await signIn('google', { redirectTo: callbackUrl });
  }

  async function handleGitHubSignIn() {
    'use server';
    await signIn('github', { redirectTo: callbackUrl });
  }

  async function handleFacebookSignIn() {
    'use server';
    await signIn('facebook', { redirectTo: callbackUrl });
  }

  async function handleTwitterSignIn() {
    'use server';
    await signIn('twitter', { redirectTo: callbackUrl });
  }

  async function handleMagicLink(formData: FormData) {
    'use server';
    const email = formData.get('email');
    if (typeof email !== 'string' || email.trim().length === 0) {
      redirect('/login?error=EmailRequired');
    }
    await signIn('nodemailer', {
      email: email.trim(),
      redirectTo: callbackUrl,
    });
  }

  async function handleCredentialsSignIn(formData: FormData) {
    'use server';
    await signIn('credentials', formData);
  }

  async function handleCredentialsRegister(formData: FormData) {
    'use server';
    const email = formData.get('email');
    const password = formData.get('password');
    const username = formData.get('username');

    if (typeof email !== 'string' || typeof password !== 'string') {
      redirect('/login?error=MissingFields');
    }

    try {
      await registerUserWithPassword({
        email,
        password,
        username: typeof username === 'string' ? username : undefined,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'UserExists') {
        redirect('/login?error=UserExists');
      }
      throw error;
    }

    await signIn('credentials', {
      identifier: email,
      password,
      redirectTo: callbackUrl,
    });
  }

  const hasGoogle =
    Boolean(process.env['AUTH_GOOGLE_ID']) &&
    Boolean(process.env['AUTH_GOOGLE_SECRET']);
  const hasGitHub =
    Boolean(process.env['AUTH_GITHUB_ID']) &&
    Boolean(process.env['AUTH_GITHUB_SECRET']);
  const hasFacebook =
    Boolean(process.env['AUTH_FACEBOOK_ID']) &&
    Boolean(process.env['AUTH_FACEBOOK_SECRET']);
  const hasTwitter =
    Boolean(process.env['AUTH_TWITTER_ID']) &&
    Boolean(process.env['AUTH_TWITTER_SECRET']);
  const hasMagicLink =
    Boolean(process.env['AUTH_EMAIL_SERVER']) &&
    Boolean(process.env['AUTH_EMAIL_FROM']);

  const hasOAuth = hasGoogle || hasGitHub || hasFacebook || hasTwitter;

  const errorMessage =
    errorCode === 'CredentialsSignin'
      ? 'Invalid email or password.'
      : errorCode === 'UserExists'
        ? 'An account with that email already exists.'
        : errorCode === 'EmailRequired'
          ? 'Please enter your email.'
          : errorCode === 'MissingFields'
            ? 'Please fill out all required fields.'
            : errorCode
              ? 'Unable to sign in. Please try again.'
              : '';

  if (session?.user) {
    return (
      <div className="auth-page">
        <div className="auth-container">
          <div className="auth-card auth-card-single">
            <div className="auth-card-icon success">
              <svg
                fill="none"
                height="32"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
                width="32"
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <h1>Already signed in</h1>
            <p className="auth-subtitle">
              You are signed in as{' '}
              <strong>
                {session.user.email ?? session.user.name ?? 'Player'}
              </strong>
            </p>
            <div className="auth-actions">
              <Link className="auth-btn primary" href="/characters">
                Go to characters
              </Link>
              <a className="auth-btn ghost" href="/logout">
                Sign out
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <h1>Welcome to Skillbound</h1>
          <p>
            Sign in to track your characters, save progress, and sync across
            devices.
          </p>
        </div>

        {errorMessage && (
          <div className="auth-error">
            <svg
              fill="none"
              height="16"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
              width="16"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" x2="12" y1="8" y2="12" />
              <line x1="12" x2="12.01" y1="16" y2="16" />
            </svg>
            {errorMessage}
          </div>
        )}

        <div className="auth-grid-modern">
          {/* Credentials Card */}
          <div className="auth-card">
            <div className="auth-card-header">
              <h2>Sign in with email</h2>
              <p>Use your Skillbound account</p>
            </div>

            <form action={handleCredentialsSignIn} className="auth-form-modern">
              <div className="auth-input-group">
                <label htmlFor="signin-identifier">Email or username</label>
                <input
                  required
                  autoComplete="username"
                  id="signin-identifier"
                  name="identifier"
                  placeholder="you@example.com"
                  type="text"
                />
              </div>
              <div className="auth-input-group">
                <label htmlFor="signin-password">Password</label>
                <input
                  required
                  autoComplete="current-password"
                  id="signin-password"
                  name="password"
                  placeholder="Your password"
                  type="password"
                />
              </div>
              <button className="auth-btn primary" type="submit">
                Sign in
              </button>
            </form>

            <div className="auth-divider">
              <span>New to Skillbound?</span>
            </div>

            <form
              action={handleCredentialsRegister}
              className="auth-form-modern"
            >
              <div className="auth-input-group">
                <label htmlFor="register-username">Username (optional)</label>
                <input
                  autoComplete="off"
                  id="register-username"
                  name="username"
                  placeholder="Choose a display name"
                  type="text"
                />
              </div>
              <div className="auth-input-group">
                <label htmlFor="register-email">Email</label>
                <input
                  required
                  autoComplete="email"
                  id="register-email"
                  name="email"
                  placeholder="you@example.com"
                  type="email"
                />
              </div>
              <div className="auth-input-group">
                <label htmlFor="register-password">Password</label>
                <input
                  required
                  autoComplete="new-password"
                  id="register-password"
                  name="password"
                  placeholder="Create a password"
                  type="password"
                />
              </div>
              <button className="auth-btn secondary" type="submit">
                Create account
              </button>
            </form>
          </div>

          {/* OAuth Card */}
          <div className="auth-card">
            <div className="auth-card-header">
              <h2>Quick sign in</h2>
              <p>Continue with a connected account</p>
            </div>

            {hasOAuth ? (
              <div className="auth-oauth-list">
                {hasGoogle && (
                  <form action={handleGoogleSignIn}>
                    <button className="auth-oauth-btn" type="submit">
                      <svg height="20" viewBox="0 0 24 24" width="20">
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
                  </form>
                )}
                {hasGitHub && (
                  <form action={handleGitHubSignIn}>
                    <button className="auth-oauth-btn" type="submit">
                      <svg
                        fill="currentColor"
                        height="20"
                        viewBox="0 0 24 24"
                        width="20"
                      >
                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                      </svg>
                      Continue with GitHub
                    </button>
                  </form>
                )}
                {hasFacebook && (
                  <form action={handleFacebookSignIn}>
                    <button className="auth-oauth-btn" type="submit">
                      <svg
                        fill="#1877F2"
                        height="20"
                        viewBox="0 0 24 24"
                        width="20"
                      >
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                      </svg>
                      Continue with Facebook
                    </button>
                  </form>
                )}
                {hasTwitter && (
                  <form action={handleTwitterSignIn}>
                    <button className="auth-oauth-btn" type="submit">
                      <svg
                        fill="currentColor"
                        height="20"
                        viewBox="0 0 24 24"
                        width="20"
                      >
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                      </svg>
                      Continue with X
                    </button>
                  </form>
                )}
              </div>
            ) : (
              <p className="auth-no-providers">
                No OAuth providers configured.
              </p>
            )}

            {hasMagicLink && (
              <>
                <div className="auth-divider">
                  <span>Or use magic link</span>
                </div>
                <form action={handleMagicLink} className="auth-form-modern">
                  <div className="auth-input-group">
                    <label htmlFor="magic-email">Email address</label>
                    <input
                      required
                      id="magic-email"
                      name="email"
                      placeholder="you@example.com"
                      type="email"
                    />
                  </div>
                  <button className="auth-btn secondary" type="submit">
                    Send magic link
                  </button>
                </form>
              </>
            )}

            <div className="auth-footer">
              <p>No account needed to browse.</p>
              <Link className="auth-btn ghost" href="/lookup">
                Continue as guest
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
