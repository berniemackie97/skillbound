// Export types
export * from './core/types';

// Export client
export * from './core/client';

// Export cache helpers
export { MemoryCache, type CacheAdapter } from '@skillbound/cache';

// Export parser
export { parseHiscoresCsv, parseHiscoresJson } from './core/parser';

// Export RuneLite client
export {
  fetchRuneLitePlayer,
  fetchAndParseRuneLitePlayer,
  parseRuneLiteData,
  calculateQuestProgress,
  calculateDiaryProgress,
  RuneLiteAPIError,
} from './runelite/runelite-client';

export type {
  RuneLitePlayerResponse,
  ParsedRuneLiteData,
  QuestStatus,
  DiaryTier,
  DiaryRegion,
  AccountType,
  QuestProgress,
  DiaryProgress,
} from './runelite/runelite-types';

// Export unified lookup
export { lookupPlayer } from './lookup/unified-lookup';
export type {
  UnifiedPlayerData,
  DataSource,
  LookupOptions,
} from './lookup/unified-lookup';
