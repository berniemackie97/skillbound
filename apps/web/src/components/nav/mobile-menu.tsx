'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

type NavLink = {
  href: string;
  label: string;
};

type MobileMenuProps = {
  links: NavLink[];
};

export function MobileMenu({ links }: MobileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const pathname = usePathname();

  const toggleMenu = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Close menu on route change
  useEffect(() => {
    closeMenu();
  }, [pathname, closeMenu]);

  // Close menu on escape key
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeMenu();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when menu is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, closeMenu]);

  return (
    <>
      {/* Hamburger button */}
      <button
        aria-expanded={isOpen}
        aria-label={isOpen ? 'Close menu' : 'Open menu'}
        className={`mobile-menu-toggle ${isOpen ? 'active' : ''}`}
        type="button"
        onClick={toggleMenu}
      >
        <span className="hamburger-line" />
        <span className="hamburger-line" />
        <span className="hamburger-line" />
      </button>

      {isMounted &&
        createPortal(
          <>
            {/* Backdrop */}
            {isOpen && (
              <div
                aria-hidden="true"
                className="mobile-menu-backdrop"
                onClick={closeMenu}
              />
            )}

            {/* Slide-out menu panel */}
            <div
              aria-hidden={!isOpen}
              className={`mobile-menu-panel ${isOpen ? 'open' : ''}`}
            >
              <nav className="mobile-menu-nav">
                {links.map((link) => (
                  <Link
                    key={link.href}
                    className={`mobile-menu-link ${pathname === link.href ? 'active' : ''}`}
                    href={link.href}
                    onClick={closeMenu}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>
          </>,
          document.body
        )}
    </>
  );
}
