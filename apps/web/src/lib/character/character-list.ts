import { z } from 'zod';

const idsSchema = z
  .string()
  .transform((value) =>
    value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
  )
  .pipe(z.array(z.string().uuid()).min(1).max(20));

const baseSchema = z.object({
  search: z.string().trim().min(1).max(50).optional(),
  mode: z
    .enum([
      'normal',
      'ironman',
      'hardcore',
      'ultimate',
      'group-ironman',
      'hardcore-group-ironman',
      'unranked-group-ironman',
    ])
    .optional(),
  includeSnapshots: z
    .string()
    .optional()
    .transform((value) => value === 'true' || value === '1'),
  limit: z
    .string()
    .optional()
    .transform((value) =>
      value === undefined ? 20 : Number.parseInt(value, 10)
    )
    .refine((value) => Number.isFinite(value), {
      message: 'Limit must be a valid number.',
    })
    .refine((value) => value >= 1 && value <= 50, {
      message: 'Limit must be between 1 and 50.',
    }),
});

export type CharacterListQuery = z.infer<typeof baseSchema> & {
  ids?: string[];
};

type SafeParseResult<T> =
  | { success: true; data: T }
  | { success: false; error: z.ZodError };

export function parseCharacterListQuery(
  params: URLSearchParams
): SafeParseResult<CharacterListQuery> {
  const baseParse = baseSchema.safeParse({
    search: params.get('search') ?? undefined,
    mode: params.get('mode') ?? undefined,
    includeSnapshots: params.get('includeSnapshots') ?? undefined,
    limit: params.get('limit') ?? undefined,
  });

  if (!baseParse.success) {
    return baseParse;
  }

  const idsParam = params.get('ids');
  if (!idsParam) {
    return {
      success: true,
      data: {
        ...baseParse.data,
      },
    };
  }

  const idsParse = idsSchema.safeParse(idsParam);
  if (!idsParse.success) {
    return idsParse;
  }

  return {
    success: true,
    data: {
      ...baseParse.data,
      ids: idsParse.data,
    },
  };
}
