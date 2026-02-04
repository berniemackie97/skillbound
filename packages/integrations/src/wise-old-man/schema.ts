import { z } from 'zod';

export const wiseOldManPlayerSchema = z
  .object({
    id: z.number().int(),
    username: z.string(),
    displayName: z.string().optional(),
    type: z.string().optional(),
    build: z.string().optional(),
    country: z.string().optional(),
    exp: z.number().optional(),
    ehp: z.number().optional(),
    ehb: z.number().optional(),
    ttm: z.number().optional(),
    tt200m: z.number().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
    lastChangedAt: z.string().optional(),
  })
  .passthrough();

const wiseOldManSkillSchema = z
  .object({
    metric: z.string(),
    experience: z.number().optional().nullable(),
    rank: z.number().optional().nullable(),
    level: z.number().optional().nullable(),
  })
  .passthrough();

const wiseOldManActivitySchema = z
  .object({
    metric: z.string(),
    score: z.number().optional().nullable(),
    rank: z.number().optional().nullable(),
  })
  .passthrough();

const wiseOldManBossSchema = z
  .object({
    metric: z.string(),
    kills: z.number().optional().nullable(),
    rank: z.number().optional().nullable(),
  })
  .passthrough();

export const wiseOldManSnapshotSchema = z
  .object({
    id: z.number().int(),
    playerId: z.number().int().optional(),
    createdAt: z.string(),
    updatedAt: z.string().nullable().optional(),
    importedAt: z.string().nullable().optional(),
    data: z
      .object({
        skills: z.record(z.string(), wiseOldManSkillSchema).optional(),
        activities: z.record(z.string(), wiseOldManActivitySchema).optional(),
        bosses: z.record(z.string(), wiseOldManBossSchema).optional(),
      })
      .passthrough(),
  })
  .passthrough();

export const wiseOldManSnapshotsSchema = z.array(wiseOldManSnapshotSchema);

export const wiseOldManErrorSchema = z
  .object({
    message: z.string().optional(),
    error: z.string().optional(),
    statusCode: z.number().optional(),
  })
  .passthrough();
