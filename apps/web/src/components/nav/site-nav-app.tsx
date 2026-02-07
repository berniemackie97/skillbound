import { headers } from 'next/headers';
import Image from 'next/image';
import Link from 'next/link';

import {
  magicLinkAction,
  registerAction,
  signInAction,
  signOutAction,
} from '@/lib/auth/auth-actions';
import { getSessionUser } from '@/lib/auth/auth-helpers';
import { getAuthProviderFlags } from '@/lib/auth/auth-providers';
import {
  getActiveCharacter,
  getUserCharacters,
} from '@/lib/character/character-selection';

import { MobileMenu } from './mobile-menu';
import { NavActions } from './nav-actions';

type NavLink = {
  href: string;
  label: string;
  requiresAuth?: boolean;
};

const NAV_LINKS: NavLink[] = [
  { href: '/characters', label: 'Characters', requiresAuth: true },
  { href: '/progression', label: 'Progression' },
  { href: '/guides', label: 'Guides' },
  { href: '/trading', label: 'Trading' },
  { href: '/calculators', label: 'Calculators' },
];

export async function SiteNavApp() {
  const headerList = await headers();
  const pathname = headerList.get('x-nav-pathname') ?? '';
  const { hasGoogle, hasGitHub, hasFacebook, hasTwitter, hasMagicLink } =
    getAuthProviderFlags();

  const sessionUser = await getSessionUser();
  const isSignedIn = Boolean(sessionUser);

  const [characters, activeSelection] = sessionUser
    ? await Promise.all([
        getUserCharacters(sessionUser.id),
        getActiveCharacter(sessionUser.id),
      ])
    : [[], { character: null }];

  const activeCharacterId = activeSelection.character?.id ?? null;
  const visibleLinks = isSignedIn
    ? NAV_LINKS
    : NAV_LINKS.filter((link) => !link.requiresAuth);
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
        {visibleLinks.map((link) => (
          <Link
            key={link.href}
            aria-current={isActive(link.href) ? 'page' : undefined}
            href={link.href}
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <MobileMenu links={visibleLinks} />

      <NavActions
        activeCharacterId={activeCharacterId}
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
        userEmail={sessionUser?.email ?? null}
        userName={sessionUser?.name ?? null}
        characters={characters.map((character) => ({
          id: character.id,
          displayName: character.displayName,
          mode: character.mode,
        }))}
      />
    </header>
  );
}
