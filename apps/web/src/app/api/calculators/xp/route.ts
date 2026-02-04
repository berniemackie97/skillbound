import {
  calculateNextMilestone,
  calculateXpToLevel,
  calculateXpToTargetXp,
  getLevelForXp,
  getXpForLevel,
  MAX_LEVEL,
  MAX_XP,
} from '@skillbound/domain';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createProblemDetails } from '@/lib/api/problem-details';

const payloadSchema = z
  .object({
    currentXp: z.number().int().min(0).max(MAX_XP).optional(),
    currentLevel: z.number().int().min(1).max(MAX_LEVEL).optional(),
    targetXp: z.number().int().min(0).max(MAX_XP).optional(),
    targetLevel: z.number().int().min(1).max(MAX_LEVEL).optional(),
  })
  .refine(
    (data) => data.currentXp !== undefined || data.currentLevel !== undefined,
    {
      message: 'Provide currentXp or currentLevel.',
    }
  )
  .refine(
    (data) => data.targetXp !== undefined || data.targetLevel !== undefined,
    {
      message: 'Provide targetXp or targetLevel.',
    }
  )
  .refine(
    (data) =>
      !(data.currentXp !== undefined && data.currentLevel !== undefined),
    {
      message: 'Provide only one of currentXp or currentLevel.',
    }
  )
  .refine(
    (data) => !(data.targetXp !== undefined && data.targetLevel !== undefined),
    {
      message: 'Provide only one of targetXp or targetLevel.',
    }
  );

type CurrentXpInput = {
  currentXp?: number | undefined;
  currentLevel?: number | undefined;
};

function resolveCurrentXp(data: CurrentXpInput) {
  if (data.currentXp !== undefined) {
    return data.currentXp;
  }

  return getXpForLevel(data.currentLevel ?? 1);
}

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => null)) as unknown;
  const parsed = payloadSchema.safeParse(payload);

  if (!parsed.success) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid calculator payload',
      detail: 'Provide valid current and target inputs.',
      errors: parsed.error.issues,
    });

    return NextResponse.json(problem, { status: problem.status });
  }

  const currentXp = resolveCurrentXp(parsed.data);
  const result =
    parsed.data.targetXp !== undefined
      ? calculateXpToTargetXp(currentXp, parsed.data.targetXp)
      : calculateXpToLevel(currentXp, parsed.data.targetLevel ?? 1);

  const milestone = calculateNextMilestone(currentXp);

  return NextResponse.json({
    data: {
      ...result,
      currentLevel: getLevelForXp(currentXp),
    },
    nextMilestone: milestone,
  });
}
