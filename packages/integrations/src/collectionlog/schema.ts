import { z } from 'zod';

export const collectionLogItemSchema = z
  .object({
    id: z.number(),
    name: z.string(),
    quantity: z.number().int().nullable().optional(),
    obtained: z.boolean().optional(),
    sequence: z.number().int().optional(),
  })
  .passthrough();

export const collectionLogKillCountSchema = z
  .object({
    name: z.string(),
    amount: z.number().int().nullable().optional(),
  })
  .passthrough();

export const collectionLogPageSchema = z
  .object({
    items: z.array(collectionLogItemSchema).optional(),
    killCount: z.array(collectionLogKillCountSchema).optional(),
  })
  .passthrough();

export const collectionLogTabsSchema = z.record(
  z.string(),
  z.record(z.string(), collectionLogPageSchema)
);

export const collectionLogSchema = z
  .object({
    username: z.string().optional(),
    accountType: z.string().optional(),
    uniqueObtained: z.number().int().optional(),
    uniqueItems: z.number().int().optional(),
    tabs: collectionLogTabsSchema.optional(),
  })
  .passthrough();

export const collectionLogUserResponseSchema = z
  .object({
    collectionLogId: z.number().optional(),
    userId: z.number().optional(),
    collectionLog: collectionLogSchema,
  })
  .passthrough();

export const collectionLogErrorSchema = z
  .object({
    error: z.string().optional(),
    message: z.string().optional(),
  })
  .passthrough();
