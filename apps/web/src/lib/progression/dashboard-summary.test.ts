import { describe, expect, it } from 'vitest';

import { summarizeCompletion } from './dashboard-summary';

describe('summarizeCompletion', () => {
  it('counts statuses correctly', () => {
    const summary = summarizeCompletion(['MET', 'NOT_MET', 'UNKNOWN', 'MET']);

    expect(summary.total).toBe(4);
    expect(summary.met).toBe(2);
    expect(summary.notMet).toBe(1);
    expect(summary.unknown).toBe(1);
  });
});
