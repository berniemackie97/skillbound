const explicitSiteUrl = process.env['NEXT_PUBLIC_SITE_URL'];
const vercelUrl = process.env['VERCEL_URL'];

function toUrl(value: string): URL | null {
  const raw = value.trim();
  if (!raw) return null;

  if (/^https?:\/\//i.test(raw)) {
    try {
      return new URL(raw);
    } catch {
      return null;
    }
  }

  try {
    return new URL(`https://${raw}`);
  } catch {
    return null;
  }
}

export function resolveSiteUrl(): URL | null {
  const fromExplicit = explicitSiteUrl ? toUrl(explicitSiteUrl) : null;
  if (fromExplicit) return fromExplicit;

  const fromVercel = vercelUrl ? toUrl(vercelUrl) : null;
  if (fromVercel) return fromVercel;

  return null;
}

export function resolveSiteOrigin(): string | null {
  const url = resolveSiteUrl();
  return url ? url.origin : null;
}