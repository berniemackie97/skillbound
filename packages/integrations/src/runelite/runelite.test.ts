import { describe, expect, it } from 'vitest';

import { parseRuneLiteBankTagsExport } from './index';

describe('RuneLite exports', () => {
  it('parses bank tag exports', () => {
    const payload = [
      'banktags,1,slayer,4151,12924',
      'banktaglayouts,1,slayer,4151,0,12924,1',
    ].join('\n');

    const result = parseRuneLiteBankTagsExport(payload);

    expect(result.tags).toHaveLength(1);
    expect(result.tags[0]?.name).toBe('slayer');
    expect(result.layouts).toHaveLength(1);
    expect(result.layouts[0]?.positions).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
  });

  it('reports invalid bank tag lines', () => {
    const payload = 'banktags,2,invalid,4151';
    const result = parseRuneLiteBankTagsExport(payload);

    expect(result.errors).toHaveLength(1);
  });

  it('reports invalid layout pairs', () => {
    const payload = 'banktaglayouts,1,slayer,4151';
    const result = parseRuneLiteBankTagsExport(payload);

    expect(result.errors).toHaveLength(1);
  });

  it('reports missing header fields', () => {
    const payload = 'banktags,1';
    const result = parseRuneLiteBankTagsExport(payload);

    expect(result.errors).toHaveLength(1);
  });

  it('reports invalid item id lists', () => {
    const payload = 'banktags,1,slayer,abc';
    const result = parseRuneLiteBankTagsExport(payload);

    expect(result.errors).toHaveLength(1);
  });

  it('reports invalid layout numeric values', () => {
    const payload = 'banktaglayouts,1,slayer,abc,0';
    const result = parseRuneLiteBankTagsExport(payload);

    expect(result.errors).toHaveLength(1);
  });

  it('reports unsupported tag types', () => {
    const payload = 'bankfoo,1,slayer,4151';
    const result = parseRuneLiteBankTagsExport(payload);

    expect(result.errors).toHaveLength(1);
  });
});
