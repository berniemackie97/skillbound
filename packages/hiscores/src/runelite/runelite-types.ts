/**
 * RuneLite Player Sync API types
 * API: https://sync.runescape.wiki/runelite/player/{username}/{account_type}
 */

export type QuestStatus = 0 | 1 | 2; // 0 = not started, 1 = in progress, 2 = completed

export type DiaryTaskCompletion = boolean[];

export interface DiaryTier {
  complete: boolean;
  tasks: DiaryTaskCompletion;
}

export interface DiaryRegion {
  Easy: DiaryTier;
  Medium: DiaryTier;
  Hard: DiaryTier;
  Elite: DiaryTier;
}

export interface RuneLitePlayerResponse {
  username: string;
  timestamp: string;

  /** Quest name -> completion status (0=not started, 1=in progress, 2=completed) */
  quests: Record<string, QuestStatus>;

  /** Achievement diary progress by region and tier */
  achievement_diaries: Record<string, DiaryRegion>;

  /** Skill levels */
  levels: Record<string, number>;

  /** Music track name -> unlocked status */
  music_tracks: Record<string, boolean>;

  /** Combat achievement IDs that are completed */
  combat_achievements: number[];

  /** League task IDs (for leagues) */
  league_tasks: number[];

  /** Bingo task IDs (for bingo events) */
  bingo_tasks: number[];

  /** Collection log entries */
  collection_log: number[];

  /** Total collection log items obtained */
  collectionLogItemCount: number | null;

  /** Sea charting data */
  sea_charting: number[];
}

export type AccountType =
  | 'STANDARD'
  | 'IRONMAN'
  | 'HARDCORE_IRONMAN'
  | 'ULTIMATE_IRONMAN'
  | 'GROUP_IRONMAN'
  | 'HARDCORE_GROUP_IRONMAN'
  | 'UNRANKED_GROUP_IRONMAN';

/**
 * Quest progress summary
 */
export interface QuestProgress {
  total: number;
  notStarted: number;
  inProgress: number;
  completed: number;
  completionPercentage: number;
}

/**
 * Achievement diary progress summary
 */
export interface DiaryProgress {
  total: number;
  completed: number;
  completionPercentage: number;
  regions: {
    name: string;
    easy: boolean;
    medium: boolean;
    hard: boolean;
    elite: boolean;
    tasksCompleted: number;
    tasksTotal: number;
  }[];
}

/**
 * Parsed RuneLite data with computed summaries
 */
export interface ParsedRuneLiteData extends RuneLitePlayerResponse {
  questProgress: QuestProgress;
  diaryProgress: DiaryProgress;
  musicTracksUnlocked: number;
  musicTracksTotal: number;
}
