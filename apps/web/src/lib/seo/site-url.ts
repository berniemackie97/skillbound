const explicitSiteUrl = process.env['NEXT_PUBLIC_SITE_URL'];
const vercelUrl = process.env['VERCEL_URL'];

export function resolveSiteUrl(): URL | null {
  if (explicitSiteUrl) {
    try {
      return new URL(explicitSiteUrl);
    } catch {
      try {
        return new URL(`https://${explicitSiteUrl}`);
      } catch {
        return null;
      }
    }
  }

  if (vercelUrl) {
    try {
      return new URL(`https://${vercelUrl}`);
    } catch {
      return null;
    }
  }

  return null;
}

export function resolveSiteOrigin(): string | null {
  const url = resolveSiteUrl();
  return url ? url.origin : null;
}
