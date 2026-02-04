import { describe, expect, it } from 'vitest';

import { guideTemplates } from './index';

describe('guide templates', () => {
  it('includes the merged BRUHsailer guide', () => {
    const guide = guideTemplates.find((template) =>
      template.title.includes('BRUHsailer')
    );

    expect(guide).toBeTruthy();
    expect(guide?.steps.length ?? 0).toBeGreaterThan(50);
  });
});
