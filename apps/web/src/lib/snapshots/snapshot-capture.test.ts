import { describe, expect, it } from 'vitest';

import type { SnapshotCaptureResult } from './snapshot-capture';
import {
  captureSnapshots,
  planSnapshotCapture,
  shouldCaptureSnapshot,
  summarizeSnapshotCapture,
} from './snapshot-capture';

type TestCharacter = {
  id: string;
  displayName?: string;
  lastSyncedAt: Date | null;
};

const now = new Date('2026-01-22T12:00:00.000Z');

describe('shouldCaptureSnapshot', () => {
  it('captures when last sync is missing', () => {
    expect(shouldCaptureSnapshot(null, now, 24 * 60 * 60 * 1000)).toBe(true);
  });

  it('captures when last sync is older than min age', () => {
    const lastSyncedAt = new Date('2026-01-20T00:00:00.000Z');
    expect(shouldCaptureSnapshot(lastSyncedAt, now, 24 * 60 * 60 * 1000)).toBe(
      true
    );
  });

  it('skips when last sync is too recent', () => {
    const lastSyncedAt = new Date('2026-01-22T06:00:00.000Z');
    expect(shouldCaptureSnapshot(lastSyncedAt, now, 24 * 60 * 60 * 1000)).toBe(
      false
    );
  });
});

describe('planSnapshotCapture', () => {
  const characters: TestCharacter[] = [
    {
      id: 'a',
      displayName: 'Recent',
      lastSyncedAt: new Date('2026-01-22T06:00:00.000Z'),
    },
    { id: 'b', displayName: 'Never', lastSyncedAt: null },
    {
      id: 'c',
      displayName: 'Old',
      lastSyncedAt: new Date('2026-01-20T00:00:00.000Z'),
    },
  ];

  it('selects due characters and skips recent ones', () => {
    const plan = planSnapshotCapture(characters, now, 24 * 60 * 60 * 1000);

    expect(plan.candidates.map((character) => character.id)).toEqual([
      'b',
      'c',
    ]);
    expect(plan.skipped).toHaveLength(1);
    expect(plan.skipped[0]?.reason).toBe('recent');
  });

  it('applies limits after sorting by oldest sync', () => {
    const plan = planSnapshotCapture(characters, now, 24 * 60 * 60 * 1000, 1);

    expect(plan.candidates.map((character) => character.id)).toEqual(['b']);
    const limitSkip = plan.skipped.find((entry) => entry.reason === 'limit');
    expect(limitSkip?.characterId).toBe('c');
  });
});

describe('captureSnapshots', () => {
  it('captures sequentially and records failures', async () => {
    const candidates: TestCharacter[] = [
      { id: 'a', displayName: 'Alpha', lastSyncedAt: null },
      { id: 'b', displayName: 'Beta', lastSyncedAt: null },
    ];
    const calls: string[] = [];

    const results = await captureSnapshots(
      candidates,
      (character) => {
        calls.push(character.id);
        if (character.id === 'b') {
          return Promise.reject(new Error('boom'));
        }
        return Promise.resolve({
          snapshotId: `snapshot-${character.id}`,
          capturedAt: now.toISOString(),
        });
      },
      {
        delayMs: 25,
        sleep: () => Promise.resolve(),
      }
    );

    expect(calls).toEqual(['a', 'b']);
    expect(results).toHaveLength(2);
    expect(results[0]?.status).toBe('captured');
    expect(results[1]?.status).toBe('failed');
  });

  it('invokes delay between captures', async () => {
    const candidates: TestCharacter[] = [
      { id: 'a', lastSyncedAt: null },
      { id: 'b', lastSyncedAt: null },
    ];
    const delays: number[] = [];

    await captureSnapshots(
      candidates,
      (character) =>
        Promise.resolve({
          snapshotId: `snapshot-${character.id}`,
          capturedAt: now.toISOString(),
        }),
      {
        delayMs: 50,
        sleep: (ms) => {
          delays.push(ms);
          return Promise.resolve();
        },
      }
    );

    expect(delays).toEqual([50]);
  });
});

describe('summarizeSnapshotCapture', () => {
  it('summarizes captured, failed, and skipped counts', () => {
    const results: SnapshotCaptureResult[] = [
      { characterId: 'a', status: 'captured' },
      { characterId: 'b', status: 'failed', error: 'boom' },
    ];
    const skipped = [
      {
        characterId: 'c',
        lastSyncedAt: null,
        reason: 'recent' as const,
      },
    ];

    const summary = summarizeSnapshotCapture(results, skipped);

    expect(summary.attempted).toBe(2);
    expect(summary.captured).toBe(1);
    expect(summary.failed).toBe(1);
    expect(summary.skipped).toBe(1);
  });
});
