/**
 * OSRS Wiki API clients
 *
 * This package provides clients for interacting with the RuneScape Wiki APIs:
 * - Real-time Prices API: Live Grand Exchange data
 * - Bucket API: Structured game data (quests, items, combat achievements, monsters)
 * - MediaWiki API: Raw wikitext and infobox parsing
 */

export * from './endpoints/prices';
export * from './endpoints/bucket';
export * from './endpoints/search';
export * from './endpoints/mediawiki';
export { MemoryCache, type CacheAdapter } from '@skillbound/cache';
