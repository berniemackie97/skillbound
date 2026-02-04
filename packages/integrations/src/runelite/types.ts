import type { z } from 'zod';

import type {
  runeliteBankTagLayoutSchema,
  runeliteBankTagSchema,
} from './schema';

export type RuneLiteBankTag = z.infer<typeof runeliteBankTagSchema>;
export type RuneLiteBankTagLayout = z.infer<typeof runeliteBankTagLayoutSchema>;

export type RuneLiteBankTagsParseResult = {
  tags: RuneLiteBankTag[];
  layouts: RuneLiteBankTagLayout[];
  errors: Array<{ line: string; reason: string }>;
};
