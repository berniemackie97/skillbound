import type { Metadata } from 'next';

export const SITE_NAME = 'SkillBound';
export const DEFAULT_TITLE = 'SkillBound - OSRS Progression Tracker';
export const DEFAULT_DESCRIPTION =
  'Track your Old School RuneScape progression, ironman milestones, quests, diaries, and Grand Exchange profits.';
export const DEFAULT_OG_IMAGE = '/opengraph-image';

export const DEFAULT_OPEN_GRAPH: NonNullable<Metadata['openGraph']> = {
  type: 'website',
  siteName: SITE_NAME,
  title: DEFAULT_TITLE,
  description: DEFAULT_DESCRIPTION,
  images: [
    {
      url: DEFAULT_OG_IMAGE,
      width: 1200,
      height: 630,
      alt: DEFAULT_TITLE,
    },
  ],
  locale: 'en_US',
  alternateLocale: ['en_GB'],
};

export const DEFAULT_TWITTER: NonNullable<Metadata['twitter']> = {
  card: 'summary_large_image',
  title: DEFAULT_TITLE,
  description: DEFAULT_DESCRIPTION,
  images: [DEFAULT_OG_IMAGE],
};

type OpenGraphType = Extract<
  NonNullable<Metadata['openGraph']>,
  { type?: string }
>['type'];

type PageMetadataOptions = {
  title: string;
  description: string;
  canonicalPath: string;
  noIndex?: boolean;
  openGraphType?: OpenGraphType;
};

export function buildPageMetadata({
  title,
  description,
  canonicalPath,
  noIndex,
  openGraphType,
}: PageMetadataOptions): Metadata {
  const brandedTitle = title.includes(SITE_NAME)
    ? title
    : `${title} | ${SITE_NAME}`;

  return {
    title: { absolute: brandedTitle },
    description,
    alternates: { canonical: canonicalPath },
    openGraph: {
      ...DEFAULT_OPEN_GRAPH,
      ...(openGraphType ? { type: openGraphType } : {}),
      title: brandedTitle,
      description,
      url: canonicalPath,
    },
    twitter: {
      ...DEFAULT_TWITTER,
      title: brandedTitle,
      description,
    },
    ...(noIndex ? { robots: { index: false, follow: true } } : {}),
  };
}
