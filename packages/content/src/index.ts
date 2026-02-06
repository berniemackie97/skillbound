export {
  combatAchievementSchema,
  contentBundleMetadataSchema,
  contentBundleSchema,
  diarySchema,
  diaryTaskSchema,
  diaryTierSchema,
  guideTemplateBundleSchema,
  questSchema,
  requirementSchema,
} from './schema';
export type {
  CombatAchievement,
  ContentBundle,
  Diary,
  DiaryTask,
  DiaryTier,
  GuideTemplateBundle,
  Quest,
} from './schema';

export { seedBundle } from './bundles/seed-v1';
export { guideTemplates } from './guides';
export type {
  GuideRequirementSeed,
  GuideStepSeed,
  GuideTemplateSeed,
} from './guides';

import { contentBundleSchema, type ContentBundle } from './schema';

export function parseContentBundle(payload: unknown): ContentBundle {
  return contentBundleSchema.parse(payload);
}
