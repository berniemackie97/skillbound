import { z } from 'zod';

export const templeEnvelopeSchema = z
  .object({
    status: z.string().optional(),
    message: z.string().optional(),
    error: z.string().optional(),
    data: z.unknown().optional(),
  })
  .passthrough();

const templeDataSchema = z.union([
  z.record(z.string(), z.unknown()),
  z.array(z.unknown()),
]);

export const templePlayerInfoSchema = templeDataSchema;
export const templePlayerStatsSchema = templeDataSchema;
export const templePlayerGainsSchema = templeDataSchema;
export const templePlayerDatapointsSchema = templeDataSchema;
