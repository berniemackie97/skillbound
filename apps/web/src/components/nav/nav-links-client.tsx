'use client';

import Link from 'next/link';

import { MobileMenu } from './mobile-menu';
import { useNavSession } from './nav-session-provider';

type NavLink = {
  href: string;
  label: string;
  requiresAuth?: boolean;
};

type NavLinksClientProps = {
  links: NavLink[];
  mobileExtraLinks?: NavLink[];
};

export function NavLinksClient({
  links,
  mobileExtraLinks = [],
}: NavLinksClientProps) {
  const { isSignedIn, isLoading } = useNavSession();
  const showAuthLinks = isSignedIn || isLoading;

  const visibleLinks = showAuthLinks
    ? links
    : links.filter((link) => !link.requiresAuth);

  return (
    <>
      <nav className="nav-links">
        {visibleLinks.map((link) => (
          <Link key={link.href} href={link.href}>
            {link.label}
          </Link>
        ))}
      </nav>
      <MobileMenu extraLinks={mobileExtraLinks} links={visibleLinks} />
    </>
  );
}
