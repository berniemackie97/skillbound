import {
  MAX_VIRTUAL_LEVEL,
  SKILLS,
  type Requirement,
  type SkillName,
} from '@skillbound/domain';
import { z } from 'zod';

import { guideTemplateSchema } from './guides/schema';

const skillNameSchema = z.enum(
  SKILLS as unknown as [SkillName, ...SkillName[]]
);

const skillLevelRequirementSchema = z.object({
  type: z.literal('skill-level'),
  skill: skillNameSchema,
  level: z.number().int().min(1).max(MAX_VIRTUAL_LEVEL),
});

const questRequirementSchema = z.object({
  type: z.literal('quest-complete'),
  questId: z.string().min(1),
});

const diaryRequirementSchema = z.object({
  type: z.literal('diary-complete'),
  diaryId: z.string().min(1),
  tier: z.string().min(1),
});

const diaryTaskRequirementSchema = z.object({
  type: z.literal('diary-task'),
  diaryId: z.string().min(1),
  tier: z.string().min(1),
  taskId: z.string().min(1),
});

const unlockRequirementSchema = z.object({
  type: z.literal('unlock-flag'),
  flagId: z.string().min(1),
});

const activityScoreRequirementSchema = z.object({
  type: z.literal('activity-score'),
  activityKey: z.string().min(1),
  score: z.number().int().min(0),
});

const combinedSkillLevelRequirementSchema = z.object({
  type: z.literal('combined-skill-level'),
  skills: z.array(skillNameSchema).min(2),
  totalLevel: z
    .number()
    .int()
    .min(1)
    .max(MAX_VIRTUAL_LEVEL * 5),
});

const combatLevelRequirementSchema = z.object({
  type: z.literal('combat-level'),
  level: z.number().int().min(1).max(MAX_VIRTUAL_LEVEL),
});

const combatAchievementRequirementSchema = z.object({
  type: z.literal('combat-achievement'),
  achievementId: z.string().min(1),
});

const itemRequirementSchema = z.object({
  type: z.literal('item-possessed'),
  itemId: z.number().int().positive(),
});

const manualCheckRequirementSchema = z.object({
  type: z.literal('manual-check'),
  label: z.string().min(1),
});

export const requirementSchema: z.ZodType<Requirement> = z.lazy(() =>
  z.discriminatedUnion('type', [
    skillLevelRequirementSchema,
    questRequirementSchema,
    diaryRequirementSchema,
    diaryTaskRequirementSchema,
    unlockRequirementSchema,
    activityScoreRequirementSchema,
    combinedSkillLevelRequirementSchema,
    combatLevelRequirementSchema,
    combatAchievementRequirementSchema,
    itemRequirementSchema,
    manualCheckRequirementSchema,
    z.object({
      type: z.literal('all-of'),
      requirements: z.array(requirementSchema),
    }),
    z.object({
      type: z.literal('any-of'),
      requirements: z.array(requirementSchema),
    }),
  ])
);

export const questSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  shortName: z.string().min(1).optional(),
  difficulty: z.string().min(1).optional(),
  questPoints: z.number().int().nonnegative().optional(),
  members: z.boolean().optional(),
  requirements: z.array(requirementSchema).default([]),
  optionalRequirements: z.array(requirementSchema).optional(),
  wikiUrl: z.string().url().optional(),
});

export const diaryTaskSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  requirements: z.array(requirementSchema).default([]),
  optionalRequirements: z.array(requirementSchema).optional(),
  wikiUrl: z.string().url().optional(),
});

export const diaryTierSchema = z.object({
  tier: z.string().min(1),
  name: z.string().min(1).optional(),
  requirements: z.array(requirementSchema).default([]),
  optionalRequirements: z.array(requirementSchema).optional(),
  tasks: z.array(diaryTaskSchema).default([]),
});

export const diarySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  region: z.string().min(1),
  tiers: z.array(diaryTierSchema).default([]),
  wikiUrl: z.string().url().optional(),
});

const combatAchievementTierSchema = z.enum([
  'Easy',
  'Medium',
  'Hard',
  'Elite',
  'Master',
  'Grandmaster',
]);

export const combatAchievementSchema = z.object({
  id: z.string().min(1),
  runeliteId: z.number().int().optional(),
  name: z.string().min(1),
  monster: z.string().min(1).optional(),
  description: z.string().min(1),
  tier: combatAchievementTierSchema,
  points: z.number().int().nonnegative(),
  notes: z.string().min(1).optional(),
  requirements: z.array(requirementSchema).default([]),
  optionalRequirements: z.array(requirementSchema).optional(),
  wikiUrl: z.string().url().optional(),
});

export const guideTemplateBundleSchema = guideTemplateSchema.extend({
  id: z.string().min(1),
});

export const contentBundleMetadataSchema = z.object({
  version: z.string().min(1),
  publishedAt: z.string().datetime(),
  sources: z.array(z.string().min(1)).min(1),
  checksum: z.string().min(1),
  notes: z.string().min(1).optional(),
  questCount: z.number().int().nonnegative().optional(),
  diaryCount: z.number().int().nonnegative().optional(),
  combatAchievementCount: z.number().int().nonnegative().optional(),
  guideCount: z.number().int().nonnegative().optional(),
  itemCount: z.number().int().nonnegative().optional(),
});

export const contentBundleSchema = z.object({
  metadata: contentBundleMetadataSchema,
  quests: z.array(questSchema).default([]),
  diaries: z.array(diarySchema).default([]),
  combatAchievements: z.array(combatAchievementSchema).default([]),
  guides: z.array(guideTemplateBundleSchema).default([]),
  items: z.array(z.unknown()).optional(),
});

export type Quest = z.infer<typeof questSchema>;
export type Diary = z.infer<typeof diarySchema>;
export type DiaryTier = z.infer<typeof diaryTierSchema>;
export type DiaryTask = z.infer<typeof diaryTaskSchema>;
export type CombatAchievement = z.infer<typeof combatAchievementSchema>;
export type GuideTemplateBundle = z.infer<typeof guideTemplateBundleSchema>;
export type ContentBundle = z.infer<typeof contentBundleSchema>;
