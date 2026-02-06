import Image from 'next/image';
import Link from 'next/link';

import {
  magicLinkAction,
  registerAction,
  signInAction,
  signOutAction,
} from '@/lib/auth/auth-actions';
import { getAuthProviderFlags } from '@/lib/auth/auth-providers';

import { MobileMenu } from './mobile-menu';
import { NavActionsClient } from './nav-actions-client';

const NAV_LINKS = [
  // { href: '/', label: 'Overview' },
  { href: '/characters', label: 'Characters' },
  { href: '/progression', label: 'Progression' },
  { href: '/guides', label: 'Guides' },
  { href: '/trading', label: 'Trading' },
  { href: '/calculators', label: 'Calculators' },
  // { href: '/snapshots', label: 'Snapshots' },
];

export function SiteNav() {
  const {
    hasGoogle,
    hasGitHub,
    hasFacebook,
    hasTwitter,
    hasMagicLink,
    hasOAuth,
  } = getAuthProviderFlags();

  const visibleLinks = NAV_LINKS;
  const mobileExtraLinks = [{ href: '/lookup', label: 'New lookup' }];

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
      {/* Desktop nav links */}
      <nav className="nav-links">
        {visibleLinks.map((link) => (
          <Link key={link.href} href={link.href}>
            {link.label}
          </Link>
        ))}
      </nav>
      {/* Mobile hamburger menu */}
      <MobileMenu extraLinks={mobileExtraLinks} links={visibleLinks} />
      <NavActionsClient
        hasFacebook={hasFacebook}
        hasGitHub={hasGitHub}
        hasGoogle={hasGoogle}
        hasMagicLink={hasMagicLink}
        hasOAuth={hasOAuth}
        hasTwitter={hasTwitter}
        magicLinkAction={hasMagicLink ? magicLinkAction : undefined}
        registerAction={registerAction}
        signInAction={signInAction}
        signOutAction={signOutAction}
      />
    </header>
  );
}
