import Link from 'next/link';
import { unstable_noStore as noStore } from 'next/cache';

import {
  magicLinkAction,
  registerAction,
  signInAction,
  signOutAction,
} from '@/lib/auth/auth-actions';
import { auth } from '@/lib/auth/auth';
import { getAuthProviderFlags } from '@/lib/auth/auth-providers';
import {
  getActiveCharacter,
  getUserCharacters,
} from '@/lib/character/character-selection';

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

  return (
    <header className="nav">
      <Link className="brand" href="/">
        <span className="brand-mark">SB</span>
        <span className="brand-name">SkillBound</span>
      </Link>
      <nav className="nav-links">
        {(user
          ? NAV_LINKS
          : NAV_LINKS.filter((link) => link.href !== '/characters')
        ).map((link) => (
          <Link key={link.href} href={link.href}>
            {link.label}
          </Link>
        ))}
      </nav>
      <NavActions
        characters={characters}
        activeCharacterId={activeCharacterId}
        isSignedIn={Boolean(user)}
        userEmail={user?.email}
        userName={user?.name}
        hasGoogle={hasGoogle}
        hasGitHub={hasGitHub}
        hasFacebook={hasFacebook}
        hasTwitter={hasTwitter}
        hasMagicLink={hasMagicLink}
        signInAction={signInAction}
        signOutAction={signOutAction}
        registerAction={registerAction}
        magicLinkAction={hasMagicLink ? magicLinkAction : undefined}
      />
    </header>
  );
}
