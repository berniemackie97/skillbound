export type HomeCounts = {
  version: string;
  questCount: number;
  diaryCount: number;
  combatAchievementCount: number;
};

export type HomeCard = {
  title: string;
  description: string;
  cta: {
    label: string;
    href: string;
  };
};

export type HomeSectionModel = {
  title: string;
  // With exactOptionalPropertyTypes, allowing explicit undefined prevents assignability pain
  description?: string | undefined;
  cards: HomeCard[];
};

export type BundleCountsMetadata = {
  version: string;

  // With exactOptionalPropertyTypes:
  // allow property to exist and be undefined (matches real bundle typing)
  questCount?: number | undefined;
  diaryCount?: number | undefined;
  combatAchievementCount?: number | undefined;
};

// This is the contract buildHomeCounts needs.
export type BundleForHomeCounts = {
  metadata: BundleCountsMetadata;
  quests: unknown[];
  diaries: unknown[];
  combatAchievements: unknown[];
};
