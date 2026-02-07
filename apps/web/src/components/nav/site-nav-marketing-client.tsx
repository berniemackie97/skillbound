'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { AuthProviderFlags } from '@/lib/auth/auth-providers';

import { MobileMenu } from './mobile-menu';
import { MobileMenuAuth } from './mobile-menu-auth';
import { NavActions } from './nav-actions';

type NavSessionResponse = {
  user: { id: string; name?: string | null; email?: string | null } | null;
  characters: Array<{ id: string; displayName: string; mode: string }>;
  activeCharacterId: string | null;
};

type NavLink = {
  href: string;
  label: string;
};

type SiteNavMarketingClientProps = AuthProviderFlags & {
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

const BASE_LINKS: NavLink[] = [
  { href: '/progression', label: 'Progression' },
  { href: '/guides', label: 'Guides' },
  { href: '/trading', label: 'Trading' },
  { href: '/calculators', label: 'Calculators' },
];

const emptySession: NavSessionResponse = {
  user: null,
  characters: [],
  activeCharacterId: null,
};

export function SiteNavMarketingClient({
  hasGoogle,
  hasGitHub,
  hasFacebook,
  hasTwitter,
  hasMagicLink,
  hasOAuth: _hasOAuth,
  signInAction,
  signOutAction,
  registerAction,
  magicLinkAction,
}: SiteNavMarketingClientProps) {
  const pathname = usePathname();
  const [session, setSession] = useState<NavSessionResponse>(emptySession);
  const isMountedRef = useRef(true);

  const loadSession = useCallback(async () => {
    try {
      const response = await fetch('/api/nav/session', {
        cache: 'no-store',
      });
      if (!response.ok) {
        if (isMountedRef.current) setSession(emptySession);
        return;
      }
      const payload = (await response.json()) as NavSessionResponse;
      if (isMountedRef.current) {
        setSession({
          user: payload.user ?? null,
          characters: payload.characters ?? [],
          activeCharacterId: payload.activeCharacterId ?? null,
        });
      }
    } catch {
      if (isMountedRef.current) setSession(emptySession);
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    void loadSession();
    return () => {
      isMountedRef.current = false;
    };
  }, [loadSession]);

  useEffect(() => {
    const handleAuthUpdated = () => {
      void loadSession();
    };
    window.addEventListener('skillbound:auth-updated', handleAuthUpdated);
    return () => {
      window.removeEventListener('skillbound:auth-updated', handleAuthUpdated);
    };
  }, [loadSession]);

  const isSignedIn = Boolean(session.user?.id);
  const navLinks = useMemo<NavLink[]>(() => {
    if (!isSignedIn) return BASE_LINKS;
    return [{ href: '/characters', label: 'Characters' }, ...BASE_LINKS];
  }, [isSignedIn]);
  const menuLinks = useMemo<NavLink[]>(
    () => [...navLinks, { href: '/lookup', label: 'New lookup' }],
    [navLinks]
  );
  const isActive = (href: string) =>
    pathname === href || (href !== '/' && pathname.startsWith(`${href}/`));

  return (
    <header className="nav">
      <Link className="brand" href="/">
        <Image
          priority
          alt=""
          className="brand-mark"
          height={40}
          src="/icon.svg"
          width={40}
        />
        <span className="brand-name">SkillBound</span>
      </Link>

      <nav className="nav-links">
        {navLinks.map((link) => (
          <Link
            key={link.href}
            aria-current={isActive(link.href) ? 'page' : undefined}
            href={link.href}
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <MobileMenu links={menuLinks}>
        <MobileMenuAuth
          hasFacebook={hasFacebook}
          hasGitHub={hasGitHub}
          hasGoogle={hasGoogle}
          hasMagicLink={hasMagicLink}
          hasTwitter={hasTwitter}
          isSignedIn={isSignedIn}
          magicLinkAction={hasMagicLink ? magicLinkAction : undefined}
          registerAction={registerAction}
          signInAction={signInAction}
          signOutAction={signOutAction}
          userEmail={session.user?.email}
          userName={session.user?.name}
        />
      </MobileMenu>

      <NavActions
        activeCharacterId={session.activeCharacterId}
        hasFacebook={hasFacebook}
        hasGitHub={hasGitHub}
        hasGoogle={hasGoogle}
        hasMagicLink={hasMagicLink}
        hasTwitter={hasTwitter}
        isSignedIn={isSignedIn}
        magicLinkAction={hasMagicLink ? magicLinkAction : undefined}
        registerAction={registerAction}
        signInAction={signInAction}
        signOutAction={signOutAction}
        userEmail={session.user?.email}
        userName={session.user?.name}
        characters={session.characters.map((character) => ({
          id: character.id,
          displayName: character.displayName,
          mode: character.mode,
        }))}
      />
    </header>
  );
}
