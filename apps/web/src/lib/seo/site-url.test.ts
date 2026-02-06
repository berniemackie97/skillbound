import { afterEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

async function loadModule() {
  vi.resetModules();
  return await import('./site-url');
}

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('resolveSiteUrl', () => {
  it('resolves an explicit site url with scheme', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://skillbound.org';

    const { resolveSiteOrigin, resolveSiteUrl } = await loadModule();
    const url = resolveSiteUrl();

    expect(url?.href).toBe('https://skillbound.org/');
    expect(resolveSiteOrigin()).toBe('https://skillbound.org');
  });

  it('resolves an explicit site url without scheme', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'skillbound.org';

    const { resolveSiteUrl } = await loadModule();

    expect(resolveSiteUrl()?.href).toBe('https://skillbound.org/');
  });

  it('falls back to the Vercel url when explicit url is missing', async () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    process.env.VERCEL_URL = 'skillbound.vercel.app';

    const { resolveSiteUrl } = await loadModule();

    expect(resolveSiteUrl()?.href).toBe('https://skillbound.vercel.app/');
  });

  it('returns null for invalid explicit urls', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = '%%';

    const { resolveSiteUrl } = await loadModule();

    expect(resolveSiteUrl()).toBeNull();
  });
});
