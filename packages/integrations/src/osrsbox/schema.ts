import { z } from 'zod';

export const osrsboxItemSchema = z
  .object({
    id: z.number().int(),
    name: z.string(),
    members: z.boolean().optional(),
    tradeable: z.boolean().optional(),
  })
  .passthrough();

export const osrsboxMonsterSchema = z
  .object({
    id: z.number().int(),
    name: z.string(),
  })
  .passthrough();
