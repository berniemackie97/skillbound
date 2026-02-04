import { z } from 'zod';

export const runeliteBankTagSchema = z.object({
  name: z.string(),
  itemIds: z.array(z.number().int()),
});

export const runeliteBankTagLayoutSchema = z.object({
  name: z.string(),
  positions: z.array(
    z.object({
      itemId: z.number().int(),
      position: z.number().int(),
    })
  ),
});
