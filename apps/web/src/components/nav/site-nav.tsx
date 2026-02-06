import Image from 'next/image';
import Link from 'next/link';

import {
  magicLinkAction,
  registerAction,
  signInAction,
  signOutAction,
} from '@/lib/auth/auth-actions';
import { getAuthProviderFlags } from '@/lib/auth/auth-providers';

import { NavActionsClient } from './nav-actions-client';
import { NavLinksClient } from './nav-links-client';
import { NavSessionProvider } from './nav-session-provider';

const NAV_LINKS = [
  // { href: '/', label: 'Overview' },
  { href: '/characters', label: 'Characters', requiresAuth: true },
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
      <NavSessionProvider>
        <NavLinksClient links={NAV_LINKS} mobileExtraLinks={mobileExtraLinks} />
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
      </NavSessionProvider>
    </header>
  );
}
