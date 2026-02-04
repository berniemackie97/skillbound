export type SnapshotCaptureSkipReason = 'recent' | 'limit';

export type SnapshotCaptureSkip = {
  characterId: string;
  displayName?: string;
  lastSyncedAt: Date | null;
  reason: SnapshotCaptureSkipReason;
};

export type SnapshotCapturePlan<T> = {
  candidates: T[];
  skipped: SnapshotCaptureSkip[];
};

export type SnapshotCaptureResult = {
  characterId: string;
  displayName?: string;
  status: 'captured' | 'failed';
  capturedAt?: string;
  snapshotId?: string;
  error?: string;
};

export type SnapshotCaptureSummary = {
  attempted: number;
  captured: number;
  failed: number;
  skipped: number;
  results: SnapshotCaptureResult[];
  skippedDetails: SnapshotCaptureSkip[];
};

export function shouldCaptureSnapshot(
  lastSyncedAt: Date | null,
  now: Date,
  minAgeMs: number
): boolean {
  if (!lastSyncedAt) {
    return true;
  }

  const ageMs = now.getTime() - lastSyncedAt.getTime();
  return ageMs >= Math.max(0, minAgeMs);
}

export function planSnapshotCapture<
  T extends { id: string; lastSyncedAt: Date | null; displayName?: string },
>(
  characters: T[],
  now: Date,
  minAgeMs: number,
  limit?: number
): SnapshotCapturePlan<T> {
  const candidates: T[] = [];
  const skipped: SnapshotCaptureSkip[] = [];

  for (const character of characters) {
    if (shouldCaptureSnapshot(character.lastSyncedAt, now, minAgeMs)) {
      candidates.push(character);
    } else {
      skipped.push({
        characterId: character.id,
        lastSyncedAt: character.lastSyncedAt ?? null,
        reason: 'recent',
        ...(character.displayName !== undefined
          ? { displayName: character.displayName }
          : {}),
      });
    }
  }

  candidates.sort((a, b) => {
    const aTime = a.lastSyncedAt
      ? a.lastSyncedAt.getTime()
      : Number.NEGATIVE_INFINITY;
    const bTime = b.lastSyncedAt
      ? b.lastSyncedAt.getTime()
      : Number.NEGATIVE_INFINITY;
    return aTime - bTime;
  });

  if (limit !== undefined && limit >= 0 && candidates.length > limit) {
    const overflow = candidates.splice(limit);
    for (const character of overflow) {
      skipped.push({
        characterId: character.id,
        lastSyncedAt: character.lastSyncedAt ?? null,
        reason: 'limit',
        ...(character.displayName !== undefined
          ? { displayName: character.displayName }
          : {}),
      });
    }
  }

  return { candidates, skipped };
}

export async function captureSnapshots<
  T extends { id: string; displayName?: string },
>(
  candidates: T[],
  sync: (character: T) => Promise<{ snapshotId: string; capturedAt: string }>,
  options: { delayMs?: number; sleep?: (ms: number) => Promise<void> } = {}
): Promise<SnapshotCaptureResult[]> {
  const delayMs = Math.max(0, options.delayMs ?? 0);
  const sleep =
    options.sleep ??
    ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const results: SnapshotCaptureResult[] = [];

  for (let index = 0; index < candidates.length; index += 1) {
    const character = candidates[index];
    if (!character) {
      continue;
    }

    try {
      const result = await sync(character);
      results.push({
        characterId: character.id,
        status: 'captured',
        capturedAt: result.capturedAt,
        snapshotId: result.snapshotId,
        ...(character.displayName !== undefined
          ? { displayName: character.displayName }
          : {}),
      });
    } catch (error) {
      results.push({
        characterId: character.id,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        ...(character.displayName !== undefined
          ? { displayName: character.displayName }
          : {}),
      });
    }

    if (delayMs > 0 && index < candidates.length - 1) {
      await sleep(delayMs);
    }
  }

  return results;
}

export function summarizeSnapshotCapture(
  results: SnapshotCaptureResult[],
  skipped: SnapshotCaptureSkip[]
): SnapshotCaptureSummary {
  const captured = results.filter(
    (result) => result.status === 'captured'
  ).length;
  const failed = results.filter((result) => result.status === 'failed').length;

  return {
    attempted: results.length,
    captured,
    failed,
    skipped: skipped.length,
    results,
    skippedDetails: skipped,
  };
}
