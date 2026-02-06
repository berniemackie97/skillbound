import type { ContentBundle } from '@skillbound/content';
import { describe, expect, it, vi } from 'vitest';

import { getLatestContentBundle } from '@/lib/content/content-bundles';

import {
  getGuideTemplateFromCatalog,
  getPublishedGuideCatalog,
} from './guide-catalog';

vi.mock('@/lib/content/content-bundles', () => ({
  getLatestContentBundle: vi.fn(),
}));

const getLatestContentBundleMock = vi.mocked(getLatestContentBundle);

describe('guide catalog', () => {
  it('returns only published guides from the latest bundle', async () => {
    const bundle = {
      guides: [
        {
          id: 'alpha-v1',
          title: 'Alpha',
          description: 'Alpha desc',
          version: 1,
          status: 'published',
          recommendedModes: ['normal'],
          tags: ['starter'],
          steps: [],
          publishedAt: '2026-01-01T00:00:00.000Z',
          deprecatedAt: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'beta-v1',
          title: 'Beta',
          description: 'Beta desc',
          version: 1,
          status: 'draft',
          recommendedModes: ['normal'],
          tags: [],
          steps: [],
          publishedAt: null,
          deprecatedAt: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    } as unknown as ContentBundle;

    getLatestContentBundleMock.mockResolvedValueOnce(bundle);

    const published = await getPublishedGuideCatalog();

    expect(published).toHaveLength(1);
    expect(published[0]?.id).toBe('alpha-v1');
  });

  it('returns the correct guide template from the catalog', async () => {
    const bundle = {
      guides: [
        {
          id: 'bruhsailer-v3',
          title: 'Bruh Sailer',
          description: 'Test guide',
          version: 3,
          status: 'published',
          recommendedModes: ['ironman'],
          tags: ['sailing'],
          steps: [],
          publishedAt: '2026-01-02T00:00:00.000Z',
          deprecatedAt: null,
          createdAt: '2026-01-02T00:00:00.000Z',
          updatedAt: '2026-01-02T00:00:00.000Z',
        },
      ],
    } as unknown as ContentBundle;

    getLatestContentBundleMock.mockResolvedValueOnce(bundle);

    const found = await getGuideTemplateFromCatalog('bruhsailer-v3');

    expect(found?.title).toBe('Bruh Sailer');
  });
});
