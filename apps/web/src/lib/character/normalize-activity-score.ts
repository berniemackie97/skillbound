const PVP_ARENA_BASELINE = 2500;

export function normalizeActivityScore(key: string, score: number): number {
  const safeScore = Number.isFinite(score) ? score : 0;
  if (key === 'pvp_arena_rank') {
    if (safeScore <= PVP_ARENA_BASELINE) {
      return 0;
    }
    return safeScore - PVP_ARENA_BASELINE;
  }
  return safeScore;
}

export { PVP_ARENA_BASELINE };
