import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import type { Metadata, Viewport } from 'next';
import { Fraunces, Space_Grotesk } from 'next/font/google';
import './styles/globals.css';

import { GoogleAnalytics } from '@/components/seo/google-analytics';
import { StructuredData } from '@/components/seo/structured-data';
import {
  DEFAULT_DESCRIPTION,
  DEFAULT_OPEN_GRAPH,
  DEFAULT_TITLE,
  DEFAULT_TWITTER,
  SITE_NAME,
} from '@/lib/seo/metadata';
import { resolveSiteUrl } from '@/lib/seo/site-url';

const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  display: 'swap',
  variable: '--font-display',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-body',
});

const siteUrl = resolveSiteUrl() ?? undefined;
const isProduction = process.env['VERCEL_ENV'] === 'production';
const googleSiteVerification =
  process.env['NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION'];

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: {
    default: DEFAULT_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: DEFAULT_DESCRIPTION,

  applicationName: SITE_NAME,
  manifest: '/manifest.json',

  icons: {
    // Keep these paths aligned with /public
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icon.svg', type: 'image/svg+xml', sizes: 'any' },
    ],
    apple: [{ url: '/icon.svg', type: 'image/svg+xml' }],
  },

  openGraph: DEFAULT_OPEN_GRAPH,
  twitter: DEFAULT_TWITTER,
  verification: googleSiteVerification
    ? { google: googleSiteVerification }
    : undefined,

  // Default: index in production, noindex elsewhere.
  robots: isProduction
    ? { index: true, follow: true }
    : { index: false, follow: false },
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
    <html className={`${fraunces.variable} ${spaceGrotesk.variable}`} lang="en">
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
        <GoogleAnalytics />
        <StructuredData />
      </body>
    </html>
  );
}
