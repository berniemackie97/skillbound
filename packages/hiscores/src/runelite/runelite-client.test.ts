import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  calculateDiaryProgress,
  calculateQuestProgress,
  fetchRuneLitePlayer,
  parseRuneLiteData,
  RuneLiteAPIError,
} from './runelite-client';
import type { RuneLitePlayerResponse } from './runelite-types';

const createMockResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: { 'Content-Type': 'application/json' },
  });

const createMockPlayerData = (
  overrides: Partial<RuneLitePlayerResponse> = {}
): RuneLitePlayerResponse => ({
  username: 'TestPlayer',
  timestamp: new Date().toISOString(),
  levels: {
    Overall: 500,
    Attack: 40,
    Defence: 40,
    Strength: 40,
    Hitpoints: 40,
    Ranged: 40,
    Prayer: 40,
    Magic: 40,
    Cooking: 40,
    Woodcutting: 40,
    Fletching: 40,
    Fishing: 40,
    Firemaking: 40,
    Crafting: 40,
    Smithing: 40,
    Mining: 40,
    Herblore: 40,
    Agility: 40,
    Thieving: 40,
    Slayer: 40,
    Farming: 40,
    Runecraft: 40,
    Hunter: 40,
    Construction: 40,
  },
  quests: {
    'Cooks Assistant': 2, // completed
    'Dragon Slayer': 1, // in progress
    'Recipe for Disaster': 0, // not started
  },
  achievement_diaries: {
    Ardougne: {
      Easy: { complete: true, tasks: [true, true, true] },
      Medium: { complete: false, tasks: [true, false, false] },
      Hard: { complete: false, tasks: [false, false, false] },
      Elite: { complete: false, tasks: [false, false, false] },
    },
  },
  music_tracks: {
    'Newbie Melody': true,
    Adventure: true,
    'Unknown Track': false,
  },
  combat_achievements: [],
  league_tasks: [],
  bingo_tasks: [],
  collection_log: [],
  collectionLogItemCount: null,
  sea_charting: [],
  ...overrides,
});

describe('RuneLiteAPIError', () => {
  it('creates error with message and status code', () => {
    const error = new RuneLiteAPIError('Player not found', 404);

    expect(error.message).toBe('Player not found');
    expect(error.statusCode).toBe(404);
    expect(error.name).toBe('RuneLiteAPIError');
  });

  it('works without status code', () => {
    const error = new RuneLiteAPIError('Network error');

    expect(error.message).toBe('Network error');
    expect(error.statusCode).toBeUndefined();
  });
});

describe('fetchRuneLitePlayer', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches player data successfully', async () => {
    const mockData = createMockPlayerData();
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(createMockResponse(mockData));

    const result = await fetchRuneLitePlayer('TestPlayer');

    expect(result.username).toBe('TestPlayer');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://sync.runescape.wiki/runelite/player/TestPlayer/STANDARD',
      expect.objectContaining({
        headers: { 'User-Agent': 'SkillBound/1.0' },
      })
    );
  });

  it('uses the specified account type', async () => {
    const mockData = createMockPlayerData();
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(createMockResponse(mockData));

    await fetchRuneLitePlayer('TestPlayer', 'IRONMAN');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://sync.runescape.wiki/runelite/player/TestPlayer/IRONMAN',
      expect.any(Object)
    );
  });

  it('throws 404 error for missing players', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(createMockResponse({}, 404));

    try {
      await fetchRuneLitePlayer('Missing');
      expect.fail('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(RuneLiteAPIError);
      expect((e as RuneLiteAPIError).statusCode).toBe(404);
    }
  });

  it('throws error with upstream message if available', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      createMockResponse({ message: 'Custom error message' }, 500)
    );

    await expect(fetchRuneLitePlayer('TestPlayer')).rejects.toThrow(
      'Custom error message'
    );
  });

  it('encodes username in URL', async () => {
    const mockData = createMockPlayerData();
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(createMockResponse(mockData));

    await fetchRuneLitePlayer('Player With Spaces');

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('Player%20With%20Spaces'),
      expect.any(Object)
    );
  });
});

describe('calculateQuestProgress', () => {
  it('calculates progress from quest states', () => {
    const quests = {
      'Quest A': 2, // completed
      'Quest B': 2, // completed
      'Quest C': 1, // in progress
      'Quest D': 0, // not started
      'Quest E': 0, // not started
    };

    const progress = calculateQuestProgress(quests);

    expect(progress.total).toBe(5);
    expect(progress.completed).toBe(2);
    expect(progress.inProgress).toBe(1);
    expect(progress.notStarted).toBe(2);
    expect(progress.completionPercentage).toBe(40); // 2/5 = 40%
  });

  it('handles empty quests', () => {
    const progress = calculateQuestProgress({});

    expect(progress.total).toBe(0);
    expect(progress.completed).toBe(0);
    expect(progress.completionPercentage).toBe(0);
  });

  it('handles all completed', () => {
    const quests = {
      'Quest A': 2,
      'Quest B': 2,
      'Quest C': 2,
    };

    const progress = calculateQuestProgress(quests);

    expect(progress.completionPercentage).toBe(100);
  });
});

describe('calculateDiaryProgress', () => {
  it('calculates progress from diary data', () => {
    const diaries = {
      Ardougne: {
        Easy: { complete: true, tasks: [true, true, true] },
        Medium: { complete: true, tasks: [true, true] },
        Hard: { complete: true, tasks: [true, true, true, true] },
        Elite: { complete: true, tasks: [true, true] },
      },
      Varrock: {
        Easy: { complete: true, tasks: [true, true] },
        Medium: { complete: false, tasks: [true, false] },
        Hard: { complete: false, tasks: [false, false] },
        Elite: { complete: false, tasks: [false] },
      },
    };

    const progress = calculateDiaryProgress(diaries);

    expect(progress.total).toBe(2);
    expect(progress.completed).toBe(1); // only Ardougne fully complete
    expect(progress.completionPercentage).toBe(50);
    expect(progress.regions).toHaveLength(2);

    const ardougne = progress.regions.find((r) => r.name === 'Ardougne');
    expect(ardougne?.easy).toBe(true);
    expect(ardougne?.elite).toBe(true);
    expect(ardougne?.tasksCompleted).toBe(11); // 3 + 2 + 4 + 2

    const varrock = progress.regions.find((r) => r.name === 'Varrock');
    expect(varrock?.medium).toBe(false);
    expect(varrock?.tasksCompleted).toBe(3); // 2 + 1 + 0 + 0
  });

  it('handles empty diaries', () => {
    const progress = calculateDiaryProgress({});

    expect(progress.total).toBe(0);
    expect(progress.completed).toBe(0);
    expect(progress.completionPercentage).toBe(0);
    expect(progress.regions).toHaveLength(0);
  });

  it('handles missing tiers gracefully', () => {
    const diaries = {
      TestRegion: {
        Easy: { complete: true, tasks: [true] },
        // Medium, Hard, Elite are missing
      },
    } as unknown as RuneLitePlayerResponse['achievement_diaries'];

    const progress = calculateDiaryProgress(diaries);

    expect(progress.regions[0]?.easy).toBe(true);
    expect(progress.regions[0]?.medium).toBe(false);
    expect(progress.regions[0]?.tasksCompleted).toBe(1);
  });
});

describe('parseRuneLiteData', () => {
  it('adds computed summaries to player data', () => {
    const rawData = createMockPlayerData();
    const parsed = parseRuneLiteData(rawData);

    expect(parsed.username).toBe('TestPlayer');
    expect(parsed.questProgress).toBeDefined();
    expect(parsed.questProgress.total).toBe(3);
    expect(parsed.questProgress.completed).toBe(1);

    expect(parsed.diaryProgress).toBeDefined();
    expect(parsed.diaryProgress.total).toBe(1);

    expect(parsed.musicTracksUnlocked).toBe(2);
    expect(parsed.musicTracksTotal).toBe(3);
  });

  it('preserves original data', () => {
    const rawData = createMockPlayerData({
      levels: { Overall: 1000, Attack: 99 },
    });
    const parsed = parseRuneLiteData(rawData);

    expect(parsed.levels['Overall']).toBe(1000);
    expect(parsed.levels['Attack']).toBe(99);
    expect(parsed.username).toBe('TestPlayer');
  });
});
