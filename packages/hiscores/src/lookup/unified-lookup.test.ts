import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as client from '../core/client';
import type { HiscoresResponse } from '../core/types';
import * as runeliteClient from '../runelite/runelite-client';
import type { ParsedRuneLiteData } from '../runelite/runelite-types';

import { lookupPlayer } from './unified-lookup';

vi.mock('../core/client');
vi.mock('../runelite/runelite-client');

const createMockRuneLiteData = (
  overrides: Partial<ParsedRuneLiteData> = {}
): ParsedRuneLiteData => ({
  username: 'TestPlayer',
  timestamp: new Date().toISOString(),
  levels: { Overall: 500, Attack: 40 },
  quests: {},
  achievement_diaries: {},
  music_tracks: {},
  combat_achievements: [],
  league_tasks: [],
  bingo_tasks: [],
  collection_log: [],
  collectionLogItemCount: null,
  sea_charting: [],
  questProgress: {
    total: 0,
    notStarted: 0,
    inProgress: 0,
    completed: 0,
    completionPercentage: 0,
  },
  diaryProgress: {
    total: 0,
    completed: 0,
    completionPercentage: 0,
    regions: [],
  },
  musicTracksUnlocked: 0,
  musicTracksTotal: 0,
  ...overrides,
});

const createMockHiscoresResponse = (
  overrides: Partial<HiscoresResponse> = {}
): HiscoresResponse => ({
  username: 'TestPlayer',
  displayName: 'TestPlayer',
  mode: 'normal',
  capturedAt: new Date().toISOString(),
  skills: [
    {
      id: 0,
      name: 'Overall',
      key: 'overall',
      isKnownSkill: true,
      rank: 1000,
      level: 500,
      xp: 10000000,
    },
  ],
  activities: [],
  ...overrides,
});

describe('lookupPlayer', () => {
  const mockLookup = vi.fn();
  const mockLookupAuto = vi.fn();
  const mockFetchAndParse = vi.mocked(runeliteClient.fetchAndParseRuneLitePlayer);

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(client.createHiscoresClient).mockReturnValue({
      lookup: mockLookup,
      lookupAuto: mockLookupAuto,
      lookupBatch: vi.fn(),
    } as unknown as ReturnType<typeof client.createHiscoresClient>);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('returns RuneLite data when available', async () => {
    const runeliteData = createMockRuneLiteData();
    const hiscoresData = createMockHiscoresResponse();

    mockFetchAndParse.mockResolvedValueOnce(runeliteData);
    mockLookupAuto.mockResolvedValueOnce(hiscoresData);

    const result = await lookupPlayer('TestPlayer');

    expect(result.source).toBe('runelite');
    expect(result.username).toBe('TestPlayer');
    expect(result.runelite).toBeDefined();
    expect(result.hiscores).toBeDefined();
    expect(result.warning).toBeUndefined();
  });

  it('falls back to hiscores when RuneLite fails', async () => {
    const hiscoresData = createMockHiscoresResponse();

    mockFetchAndParse.mockRejectedValueOnce(
      new runeliteClient.RuneLiteAPIError('Not found', 404)
    );
    mockLookupAuto.mockResolvedValueOnce(hiscoresData);

    const result = await lookupPlayer('TestPlayer');

    expect(result.source).toBe('hiscores');
    expect(result.runelite).toBeUndefined();
    expect(result.hiscores).toBeDefined();
    expect(result.warning).toContain('RuneLite data unavailable');
  });

  it('tries STANDARD fallback when specified account type fails', async () => {
    const runeliteData = createMockRuneLiteData();
    const hiscoresData = createMockHiscoresResponse();

    // First call (IRONMAN) fails, second call (STANDARD) succeeds
    mockFetchAndParse
      .mockRejectedValueOnce(new runeliteClient.RuneLiteAPIError('Not found', 404))
      .mockResolvedValueOnce(runeliteData);
    mockLookupAuto.mockResolvedValueOnce(hiscoresData);

    const result = await lookupPlayer('TestPlayer', { accountType: 'IRONMAN' });

    expect(mockFetchAndParse).toHaveBeenCalledTimes(2);
    expect(mockFetchAndParse).toHaveBeenNthCalledWith(1, 'TestPlayer', 'IRONMAN');
    expect(mockFetchAndParse).toHaveBeenNthCalledWith(2, 'TestPlayer', 'STANDARD');
    expect(result.source).toBe('runelite');
  });

  it('skips RuneLite when skipRuneLite option is set', async () => {
    const hiscoresData = createMockHiscoresResponse();
    mockLookupAuto.mockResolvedValueOnce(hiscoresData);

    const result = await lookupPlayer('TestPlayer', { skipRuneLite: true });

    expect(mockFetchAndParse).not.toHaveBeenCalled();
    expect(result.source).toBe('hiscores');
    expect(result.warning).toBeUndefined();
  });

  it('uses specified hiscoresMode', async () => {
    const hiscoresData = createMockHiscoresResponse({ mode: 'ironman' });

    mockFetchAndParse.mockRejectedValueOnce(
      new runeliteClient.RuneLiteAPIError('Not found', 404)
    );
    mockLookup.mockResolvedValueOnce(hiscoresData);

    const result = await lookupPlayer('TestPlayer', { hiscoresMode: 'ironman' });

    expect(mockLookup).toHaveBeenCalledWith('TestPlayer', 'ironman');
    expect(mockLookupAuto).not.toHaveBeenCalled();
    expect(result.hiscores.mode).toBe('ironman');
  });

  it('throws hiscores error when strictHiscores is true', async () => {
    mockFetchAndParse.mockRejectedValueOnce(
      new runeliteClient.RuneLiteAPIError('Not found', 404)
    );
    mockLookupAuto.mockRejectedValueOnce(new Error('Hiscores failed'));

    await expect(
      lookupPlayer('TestPlayer', { strictHiscores: true })
    ).rejects.toThrow('Hiscores failed');
  });

  it('throws combined error when both sources fail and strictHiscores is false', async () => {
    mockFetchAndParse.mockRejectedValueOnce(
      new runeliteClient.RuneLiteAPIError('RuneLite unavailable', 404)
    );
    mockLookupAuto.mockRejectedValueOnce(new Error('Hiscores failed'));

    await expect(lookupPlayer('TestPlayer')).rejects.toThrow(
      'RuneLite data unavailable'
    );
  });

  it('synthesizes hiscores from RuneLite data when hiscores fetch fails', async () => {
    const runeliteData = createMockRuneLiteData({
      levels: { Overall: 1000, Attack: 99, Hitpoints: 99 },
    });

    mockFetchAndParse.mockResolvedValueOnce(runeliteData);
    mockLookupAuto.mockRejectedValueOnce(new Error('Hiscores unavailable'));

    const result = await lookupPlayer('TestPlayer');

    expect(result.source).toBe('runelite');
    expect(result.hiscores).toBeDefined();
    // Synthesized hiscores should have skills from RuneLite data
    expect(result.hiscores.username).toBe('TestPlayer');
    expect(result.hiscores.skills.length).toBeGreaterThan(0);
  });

  it('passes hiscores client options', async () => {
    const hiscoresData = createMockHiscoresResponse();
    mockLookupAuto.mockResolvedValueOnce(hiscoresData);

    await lookupPlayer('TestPlayer', {
      skipRuneLite: true,
      hiscoresRetries: 5,
      hiscoresRetryDelay: 1000,
    });

    expect(client.createHiscoresClient).toHaveBeenCalledWith({
      retries: 5,
      retryDelay: 1000,
    });
  });

  it('handles non-RuneLiteAPIError errors gracefully', async () => {
    const hiscoresData = createMockHiscoresResponse();

    mockFetchAndParse.mockRejectedValueOnce(new Error('Network error'));
    mockLookupAuto.mockResolvedValueOnce(hiscoresData);

    const result = await lookupPlayer('TestPlayer');

    expect(result.source).toBe('hiscores');
    expect(result.warning).toContain('RuneLite lookup failed');
  });
});
