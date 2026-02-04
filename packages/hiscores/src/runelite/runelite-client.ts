import type {
  AccountType,
  DiaryProgress,
  ParsedRuneLiteData,
  QuestProgress,
  RuneLitePlayerResponse,
} from './runelite-types';

const RUNELITE_API_BASE = 'https://sync.runescape.wiki/runelite';

export class RuneLiteAPIError extends Error {
  constructor(
    message: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'RuneLiteAPIError';
  }
}

/**
 * Fetch player data from RuneLite sync API
 */
export async function fetchRuneLitePlayer(
  username: string,
  accountType: AccountType = 'STANDARD'
): Promise<RuneLitePlayerResponse> {
  const url = `${RUNELITE_API_BASE}/player/${encodeURIComponent(username)}/${accountType}`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'SkillBound/1.0',
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new RuneLiteAPIError(
        `Player "${username}" not found or has not synced RuneLite data`,
        404
      );
    }

    let errorMessage = `Failed to fetch player data: ${response.statusText}`;
    try {
      const errorData = (await response.json()) as RuneLiteAPIError;
      if (errorData.message) {
        errorMessage = errorData.message;
      }
    } catch {
      // Ignore JSON parse errors
    }

    throw new RuneLiteAPIError(errorMessage, response.status);
  }

  const data = (await response.json()) as RuneLitePlayerResponse;
  return data;
}

/**
 * Calculate quest progress summary
 */
export function calculateQuestProgress(
  quests: Record<string, number>
): QuestProgress {
  const questStatuses = Object.values(quests);
  const total = questStatuses.length;
  const notStarted = questStatuses.filter((s) => s === 0).length;
  const inProgress = questStatuses.filter((s) => s === 1).length;
  const completed = questStatuses.filter((s) => s === 2).length;

  return {
    total,
    notStarted,
    inProgress,
    completed,
    completionPercentage: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}

/**
 * Calculate achievement diary progress summary
 */
export function calculateDiaryProgress(
  diaries: RuneLitePlayerResponse['achievement_diaries']
): DiaryProgress {
  const regions = Object.entries(diaries).map(([name, tiers]) => {
    const tasksCompleted =
      (tiers.Easy?.tasks?.filter(Boolean).length || 0) +
      (tiers.Medium?.tasks?.filter(Boolean).length || 0) +
      (tiers.Hard?.tasks?.filter(Boolean).length || 0) +
      (tiers.Elite?.tasks?.filter(Boolean).length || 0);

    const tasksTotal =
      (tiers.Easy?.tasks?.length || 0) +
      (tiers.Medium?.tasks?.length || 0) +
      (tiers.Hard?.tasks?.length || 0) +
      (tiers.Elite?.tasks?.length || 0);

    return {
      name,
      easy: tiers.Easy?.complete || false,
      medium: tiers.Medium?.complete || false,
      hard: tiers.Hard?.complete || false,
      elite: tiers.Elite?.complete || false,
      tasksCompleted,
      tasksTotal,
    };
  });

  const completed = regions.filter(
    (r) => r.easy && r.medium && r.hard && r.elite
  ).length;
  const total = regions.length;

  return {
    total,
    completed,
    completionPercentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    regions,
  };
}

/**
 * Parse RuneLite data and add computed summaries
 */
export function parseRuneLiteData(
  data: RuneLitePlayerResponse
): ParsedRuneLiteData {
  const questProgress = calculateQuestProgress(data.quests);
  const diaryProgress = calculateDiaryProgress(data.achievement_diaries);

  const musicTracks = Object.values(data.music_tracks);
  const musicTracksUnlocked = musicTracks.filter(Boolean).length;
  const musicTracksTotal = musicTracks.length;

  return {
    ...data,
    questProgress,
    diaryProgress,
    musicTracksUnlocked,
    musicTracksTotal,
  };
}

/**
 * Fetch and parse RuneLite player data with summaries
 */
export async function fetchAndParseRuneLitePlayer(
  username: string,
  accountType: AccountType = 'STANDARD'
): Promise<ParsedRuneLiteData> {
  const data = await fetchRuneLitePlayer(username, accountType);
  return parseRuneLiteData(data);
}
