import type { CharacterSnapshot } from '@skillbound/database';
import { z } from 'zod';

const characterIdSchema = z.string().uuid();

const compareQuerySchema = z.object({
  characterIds: z
    .string()
    .min(1, { message: 'characterIds is required.' })
    .transform((value) =>
      value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
    )
    .pipe(
      z
        .array(characterIdSchema)
        .min(2, { message: 'Provide at least two character ids.' })
        .max(5, { message: 'Provide no more than five character ids.' })
    ),
});

export type CompareQuery = z.infer<typeof compareQuerySchema>;

export function parseCompareQuery(params: URLSearchParams) {
  return compareQuerySchema.safeParse({
    characterIds: params.get('characterIds') ?? '',
  });
}

export function buildLatestSnapshotMap(
  snapshots: CharacterSnapshot[]
): Map<string, CharacterSnapshot> {
  const latest = new Map<string, CharacterSnapshot>();

  for (const snapshot of snapshots) {
    const existing = latest.get(snapshot.profileId);
    if (!existing || snapshot.capturedAt > existing.capturedAt) {
      latest.set(snapshot.profileId, snapshot);
    }
  }

  return latest;
}
