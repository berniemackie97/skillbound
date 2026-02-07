import { describe, expect, it } from 'vitest';

import { normalizeActivityScore } from './normalize-activity-score';

describe('normalizeActivityScore', () => {
  it('treats baseline PvP arena score as zero', () => {
    expect(normalizeActivityScore('pvp_arena_rank', 2500)).toBe(0);
  });

  it('normalizes PvP arena scores above baseline', () => {
    expect(normalizeActivityScore('pvp_arena_rank', 2750)).toBe(250);
  });

  it('clamps PvP arena scores below baseline to zero', () => {
    expect(normalizeActivityScore('pvp_arena_rank', 2400)).toBe(0);
  });

  it('passes through other activity scores', () => {
    expect(normalizeActivityScore('barrows', 42)).toBe(42);
  });

  it('handles non-finite values', () => {
    expect(normalizeActivityScore('pvp_arena_rank', Number.NaN)).toBe(0);
  });
});
