import { NextResponse, type NextRequest } from 'next/server';

function resolveCanonicalHost(): string | null {
  const raw = process.env['NEXT_PUBLIC_SITE_URL'];
  if (!raw) return null;

  try {
    return new URL(raw).host;
  } catch {
    try {
      return new URL(`https://${raw}`).host;
    } catch {
      return null;
    }
  }
}

export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nav-pathname', request.nextUrl.pathname);

  if (process.env['VERCEL_ENV'] !== 'production') {
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  const canonicalHost = resolveCanonicalHost();
  if (!canonicalHost) return NextResponse.next();

  const currentHost = request.nextUrl.host;
  if (currentHost === canonicalHost) {
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  const url = request.nextUrl.clone();
  url.host = canonicalHost;
  url.protocol = 'https';
  return NextResponse.redirect(url, 308);
}

export const config = {
  matcher: '/:path*',
};
