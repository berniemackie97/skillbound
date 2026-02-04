import { describe, expect, it } from 'vitest';

import { parseCharacterListQuery } from './character-list';

// Valid RFC 4122 UUIDs (version 4, variant 1)
const idA = '11111111-1111-4111-8111-111111111111';
const idB = '22222222-2222-4222-8222-222222222222';

describe('parseCharacterListQuery', () => {
  it('parses ids and defaults', () => {
    const params = new URLSearchParams({ ids: `${idA}, ${idB}` });
    const parsed = parseCharacterListQuery(params);

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.ids).toEqual([idA, idB]);
      expect(parsed.data.limit).toBe(20);
      expect(parsed.data.includeSnapshots).toBe(false);
    }
  });

  it('parses search and mode', () => {
    const params = new URLSearchParams({
      search: '  Lynx  ',
      mode: 'ironman',
      includeSnapshots: 'true',
      limit: '5',
    });
    const parsed = parseCharacterListQuery(params);

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.search).toBe('Lynx');
      expect(parsed.data.mode).toBe('ironman');
      expect(parsed.data.includeSnapshots).toBe(true);
      expect(parsed.data.limit).toBe(5);
    }
  });

  it('rejects invalid ids', () => {
    const params = new URLSearchParams({ ids: 'bad-id' });
    const parsed = parseCharacterListQuery(params);

    expect(parsed.success).toBe(false);
  });

  it('rejects invalid limit', () => {
    const params = new URLSearchParams({ limit: '500' });
    const parsed = parseCharacterListQuery(params);

    expect(parsed.success).toBe(false);
  });
});
