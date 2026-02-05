import { z } from 'zod';

const guideRequirementTypeSchema = z.enum([
  'skill_level',
  'quest_complete',
  'diary_complete',
  'unlock_flag',
  'manual_check',
]);

export const guideRequirementSchema = z.object({
  type: guideRequirementTypeSchema,
  data: z.record(z.string(), z.unknown()),
  optional: z.boolean().optional(),
});

const guideImageUrlSchema = z
  .string()
  .min(1)
  .refine((value) => value.startsWith('/') || value.startsWith('http'), {
    message: 'imageUrl must be an absolute URL or root-relative path',
  });

export const guideInstructionSchema = z.object({
  /** The instruction text describing what to do */
  text: z.string().min(1),
  /** Optional image URL for visual reference (e.g., map location screenshot) */
  imageUrl: guideImageUrlSchema.optional(),
  /** Optional alt text for the image for accessibility */
  imageAlt: z.string().optional(),
  /** Optional link to open when clicking the image */
  imageLink: z.string().url().optional(),
  /** Optional note or tip for this specific instruction */
  note: z.string().optional(),
});

/**
 * Schema for a stat requirement (skill level)
 */
export const guideStatRequirementSchema = z.object({
  /** The skill name (e.g., "Firemaking", "Woodcutting") */
  skill: z.string().min(1),
  /** The required/after level */
  level: z.number().int().positive(),
  /** Optional icon identifier for the skill */
  icon: z.string().optional(),
  /** Optional note about this stat requirement */
  note: z.string().optional(),
});

/**
 * Schema for an item needed
 */
export const guideItemNeededSchema = z.object({
  name: z.string().min(1),
  qty: z.number().int().positive().default(1),
  consumed: z.boolean().optional(),
  note: z.string().optional(),
  /** Optional icon identifier for the item */
  icon: z.string().optional(),
});

export const guideStepSchema = z.object({
  stepNumber: z.number().int().positive(),
  title: z.string().min(1),
  /**
   * Structured list of instructions for this step.
   * Each instruction is an atomic action with optional image support.
   */
  instructions: z.array(guideInstructionSchema).default([]),
  requirements: z.array(guideRequirementSchema).default([]),
  optionalRequirements: z.array(guideRequirementSchema).optional(),
  wikiLinks: z.array(z.string()).optional(),
  calculatorLinks: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  section: z
    .object({
      id: z.string().min(1),
      title: z.string().min(1),
      description: z.string().optional(),
      chapterTitle: z.string().optional(),
    })
    .optional(),
  meta: z
    .object({
      gpStack: z
        .object({
          note: z.string().optional(),
          min: z.number().int().nonnegative().optional(),
          max: z.number().int().nonnegative().optional(),
        })
        .refine(
          (v) => v.min === undefined || v.max === undefined || v.max >= v.min,
          { message: 'gpStack.max must be >= gpStack.min' }
        )
        .optional(),

      itemsNeeded: z.array(guideItemNeededSchema).default([]),

      /**
       * Stats section with required and after-completion stats
       */
      stats: z
        .object({
          /** Stats that must be met to complete the step */
          required: z.array(guideStatRequirementSchema).default([]),
          /** Stats expected after completing the step */
          after: z.array(guideStatRequirementSchema).optional(),
          /**
           * @deprecated Use stats.after instead
           */
          recommended: z.array(guideStatRequirementSchema).optional(),
        })
        .optional(),

      alternativeRoutes: z
        .array(
          z.object({
            title: z.string().optional(),
            text: z.string().min(1),
          })
        )
        .default([]),
    })
    .optional(),
});

export const guideTemplateSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  version: z.number().int().positive(),
  status: z.enum(['draft', 'published', 'deprecated']),
  recommendedModes: z.array(z.string()).default(['normal']),
  tags: z.array(z.string()).default([]),
  steps: z.array(guideStepSchema).min(1),
});

export type GuideInstructionSeed = z.infer<typeof guideInstructionSchema>;
export type GuideStatRequirementSeed = z.infer<
  typeof guideStatRequirementSchema
>;
export type GuideItemNeededSeed = z.infer<typeof guideItemNeededSchema>;
export type GuideRequirementSeed = z.infer<typeof guideRequirementSchema>;
export type GuideStepSeed = z.infer<typeof guideStepSchema>;
export type GuideTemplateSeed = z.infer<typeof guideTemplateSchema>;
