import bruhsailerParsed from './bruhsailer-parsed.json';
import { guideTemplateSchema, type GuideTemplateSeed } from './schema';

export {
  guideRequirementSchema,
  guideStepSchema,
  guideTemplateSchema,
} from './schema';
export type {
  GuideRequirementSeed,
  GuideStepSeed,
  GuideTemplateSeed,
} from './schema';

export const guideTemplates: GuideTemplateSeed[] = [
  guideTemplateSchema.parse(bruhsailerParsed),
];
