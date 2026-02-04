import { describe, expect, it } from 'vitest';

import { AUTO_MODE_ORDER, resolveLookupMode } from './lookup-mode';

describe('lookup mode helpers', () => {
  it('resolves mode aliases', () => {
    expect(resolveLookupMode('iron')).toBe('ironman');
    expect(resolveLookupMode('uim')).toBe('ultimate-ironman');
    expect(resolveLookupMode('hc')).toBe('hardcore-ironman');
    expect(resolveLookupMode('normal')).toBe('normal');
  });

  it('returns null for unsupported modes', () => {
    expect(resolveLookupMode('unknown')).toBeNull();
  });

  it('keeps a deterministic auto order', () => {
    expect(AUTO_MODE_ORDER).toEqual([
      'normal',
      'ironman',
      'hardcore-ironman',
      'ultimate-ironman',
    ]);
  });
});
