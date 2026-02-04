import { describe, expect, it } from 'vitest';

import { getBucketKey, getBucketStart } from './snapshot-buckets';

describe('snapshot bucket helpers', () => {
  it('returns start of day in UTC', () => {
    const date = new Date('2026-03-15T10:30:00.000Z');
    const start = getBucketStart(date, 'day');

    expect(start.toISOString()).toBe('2026-03-15T00:00:00.000Z');
  });

  it('returns ISO week start (Monday)', () => {
    const date = new Date('2026-03-15T10:30:00.000Z');
    const start = getBucketStart(date, 'week');

    expect(start.toISOString()).toBe('2026-03-09T00:00:00.000Z');
  });

  it('returns start of month in UTC', () => {
    const date = new Date('2026-03-15T10:30:00.000Z');
    const start = getBucketStart(date, 'month');

    expect(start.toISOString()).toBe('2026-03-01T00:00:00.000Z');
  });

  it('builds bucket keys', () => {
    const date = new Date('2026-03-15T10:30:00.000Z');

    expect(getBucketKey(date, 'day')).toBe('2026-03-15');
    expect(getBucketKey(date, 'week')).toBe('2026-03-09');
    expect(getBucketKey(date, 'month')).toBe('2026-03-01');
  });
});
