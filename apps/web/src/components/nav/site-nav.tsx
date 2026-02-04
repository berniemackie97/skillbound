import Link from 'next/link';
import { unstable_noStore as noStore } from 'next/cache';

import { getSessionUser } from '@/lib/auth/auth-helpers';
import {
  getActiveCharacter,
  getUserCharacters,
} from '@/lib/character/character-selection';

import { CharacterSwitcher } from '../characters/character-switcher';
import { NavAuth } from './nav-auth';

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
  const user = await getSessionUser();
  const characters = user ? await getUserCharacters(user.id) : [];
  const activeSelection = user ? await getActiveCharacter(user.id) : null;
  const activeCharacterId = activeSelection?.character?.id ?? null;

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
      <div className="nav-actions">
        {user && characters.length > 0 && (
          <CharacterSwitcher
            characters={characters}
            activeCharacterId={activeCharacterId}
          />
        )}
        <NavAuth />
        <Link className="button" href="/lookup">
          New lookup
        </Link>
      </div>
    </header>
  );
}
