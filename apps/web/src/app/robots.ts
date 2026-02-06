import type { MetadataRoute } from 'next';

import { resolveSiteOrigin } from '@/lib/seo/site-url';

export default function robots(): MetadataRoute.Robots {
  const isProduction = process.env['VERCEL_ENV'] === 'production';
  const origin = resolveSiteOrigin();

  return {
    rules: isProduction
      ? { userAgent: '*', allow: '/' }
      : { userAgent: '*', disallow: '/' },
    sitemap: origin ? `${origin}/sitemap.xml` : undefined,
  };
}
