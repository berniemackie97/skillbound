import type { Metadata, Viewport } from 'next';
import './styles/globals.css';

import { SiteNav } from '@/components/nav/site-nav';
import { SiteFooter } from '@/components/site/site-footer';

// If you deploy to a stable production URL, set this to your canonical.
// Example: new URL('https://skillbound.gg')
const siteUrl = process.env['NEXT_PUBLIC_SITE_URL']
  ? new URL(process.env['NEXT_PUBLIC_SITE_URL'])
  : undefined;

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: {
    default: 'SkillBound - OSRS Progression Tracker',
    template: '%s | SkillBound',
  },
  description: 'Track your Old School RuneScape character progression',

  applicationName: 'SkillBound',
  manifest: '/manifest.json',

  // Helps prevent duplicate-content/canonical ambiguity once you have multiple routes.
  alternates: siteUrl ? { canonical: siteUrl } : undefined,

  icons: {
    // Keep these paths aligned with /public
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icon.svg', type: 'image/svg+xml', sizes: 'any' },
    ],
    apple: [{ url: '/icon.svg', type: 'image/svg+xml' }],
  },

  // Nice baseline. Can be expanded later (twitter/openGraph) when you have a public domain.
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: '#1a1612',
  // Optional: avoids mobile “zoom on input focus” shenanigans if you set font-size < 16px.
  // width: 'device-width',
  // initialScale: 1,
};

type RootLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>
        {/* Skip link: cheap accessibility win, zero design impact unless focused */}
        <a className="skip-link" href="#main">
          Skip to content
        </a>

        <div className="shell">
          <SiteNav />

          <main className="page" id="main">
            {children}
          </main>

          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
