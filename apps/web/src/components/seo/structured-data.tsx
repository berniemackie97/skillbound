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
        logo: {
          '@type': 'ImageObject',
          url: `${origin}/icon-512.png`,
        },
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
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${origin}/lookup?username={search_term_string}`,
          },
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

  const safeJson = JSON.stringify(jsonLd).replace(/<\/script/gi, '<\\/script');

  return (
    <script
      dangerouslySetInnerHTML={{ __html: safeJson }}
      type="application/ld+json"
    />
  );
}