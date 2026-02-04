import { unstable_noStore as noStore } from 'next/cache';
import Link from 'next/link';

import { auth } from '@/lib/auth/auth';
import {
  magicLinkAction,
  registerAction,
  signInAction,
  signOutAction,
} from '@/lib/auth/auth-actions';
import { getAuthProviderFlags } from '@/lib/auth/auth-providers';
import {
  getActiveCharacter,
  getUserCharacters,
} from '@/lib/character/character-selection';

import { MobileMenu } from './mobile-menu';
import { NavActions } from './nav-actions';

const NAV_LINKS = [
  // { href: '/', label: 'Overview' },
  { href: '/characters', label: 'Characters' },
  { href: '/progression', label: 'Progression' },
  { href: '/guides', label: 'Guides' },
  { href: '/trading', label: 'Trading' },
  { href: '/calculators', label: 'Calculators' },
  // { href: '/snapshots', label: 'Snapshots' },
];

export async function SiteNav() {
  noStore();
  const session = await auth();
  const user = session?.user;
  const characters = user ? await getUserCharacters(user.id) : [];
  const activeSelection = user ? await getActiveCharacter(user.id) : null;
  const activeCharacterId = activeSelection?.character?.id ?? null;

  const { hasGoogle, hasGitHub, hasFacebook, hasTwitter, hasMagicLink } =
    getAuthProviderFlags();

  // Filter links based on auth status
  const visibleLinks = user
    ? NAV_LINKS
    : NAV_LINKS.filter((link) => link.href !== '/characters');

  return (
    <header className="nav">
      <Link className="brand" href="/">
        <span className="brand-mark">SB</span>
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
      <MobileMenu links={visibleLinks} />
      <NavActions
        activeCharacterId={activeCharacterId}
        characters={characters}
        hasFacebook={hasFacebook}
        hasGitHub={hasGitHub}
        hasGoogle={hasGoogle}
        hasMagicLink={hasMagicLink}
        hasTwitter={hasTwitter}
        isSignedIn={Boolean(user)}
        magicLinkAction={hasMagicLink ? magicLinkAction : undefined}
        registerAction={registerAction}
        signInAction={signInAction}
        signOutAction={signOutAction}
        userEmail={user?.email}
        userName={user?.name}
      />
    </header>
  );
}
