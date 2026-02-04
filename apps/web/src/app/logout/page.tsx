import Link from 'next/link';
import { redirect } from 'next/navigation';

import { auth, signOut } from '@/lib/auth/auth';

export default async function LogoutPage() {
  const session = await auth();

  async function handleSignOut() {
    'use server';
    await signOut({ redirectTo: '/' });
  }

  if (!session?.user) {
    redirect('/login');
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-card auth-card-single">
          <div className="auth-card-icon warning">
            <svg fill="none" height="32" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="32">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16,17 21,12 16,7" />
              <line x1="21" x2="9" y1="12" y2="12" />
            </svg>
          </div>
          <h1>Sign out</h1>
          <p className="auth-subtitle">
            You are currently signed in as{' '}
            <strong>{session.user.email ?? session.user.name ?? 'Player'}</strong>
          </p>
          <p className="auth-description">
            Are you sure you want to sign out? You can always sign back in to access your saved characters and progress.
          </p>
          <div className="auth-actions">
            <form action={handleSignOut}>
              <button className="auth-btn danger" type="submit">
                Yes, sign me out
              </button>
            </form>
            <Link className="auth-btn ghost" href="/characters">
              Cancel
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
