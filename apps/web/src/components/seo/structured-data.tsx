import { DEFAULT_DESCRIPTION, SITE_NAME } from '@/lib/seo/metadata';
import { resolveSiteOrigin } from '@/lib/seo/site-url';

const DEFAULT_LANGUAGE = 'en';

export function StructuredData() {
  const origin = resolveSiteOrigin();
  if (!origin) return null;

  const organizationId = `${origin}/#organization`;
  const websiteId = `${origin}/#website`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': organizationId,
        name: SITE_NAME,
        url: origin,
        logo: `${origin}/icon-512.png`,
      },
      {
        '@type': 'WebSite',
        '@id': websiteId,
        url: origin,
        name: SITE_NAME,
        publisher: { '@id': organizationId },
        inLanguage: DEFAULT_LANGUAGE,
        potentialAction: {
          '@type': 'SearchAction',
          target: `${origin}/lookup?username={search_term_string}`,
          'query-input': 'required name=search_term_string',
        },
      },
      {
        '@type': 'WebApplication',
        name: SITE_NAME,
        applicationCategory: 'GameApplication',
        operatingSystem: 'Any',
        url: origin,
        description: DEFAULT_DESCRIPTION,
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
        },
      },
    ],
  };

  return (
    <script
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      type="application/ld+json"
    />
  );
}
