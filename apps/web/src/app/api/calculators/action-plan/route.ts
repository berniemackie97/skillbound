import {
  calculateActionPlan,
  calculateXpToLevel,
  calculateXpToTargetXp,
  estimateTimeToComplete,
  getXpForLevel,
  MAX_LEVEL,
  MAX_XP,
} from '@skillbound/domain';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createProblemDetails } from '@/lib/api/problem-details';

const actionSchema = z.object({
  name: z.string().min(1),
  xpPerAction: z.number().positive(),
  actionsCompleted: z.number().int().nonnegative().optional(),
  secondsPerAction: z.number().positive().optional(),
});

const payloadSchema = z
  .object({
    currentXp: z.number().int().min(0).max(MAX_XP).optional(),
    currentLevel: z.number().int().min(1).max(MAX_LEVEL).optional(),
    targetXp: z.number().int().min(0).max(MAX_XP).optional(),
    targetLevel: z.number().int().min(1).max(MAX_LEVEL).optional(),
    actions: z.array(actionSchema).min(1),
  })
  .refine(
    (data) => data.currentXp !== undefined || data.currentLevel !== undefined,
    {
      message: 'Provide currentXp or currentLevel.',
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
      title: 'Invalid action plan payload',
      detail: 'Provide valid current inputs and at least one action.',
      errors: parsed.error.issues,
    });

    return NextResponse.json(problem, { status: problem.status });
  }

  const currentXp = resolveCurrentXp({
    currentXp: parsed.data.currentXp,
    currentLevel: parsed.data.currentLevel,
  });

  const actions = parsed.data.actions.map((action) => ({
    name: action.name,
    xpPerAction: action.xpPerAction,
    ...(action.actionsCompleted !== undefined
      ? { actionsCompleted: action.actionsCompleted }
      : {}),
  }));

  const plan = calculateActionPlan(currentXp, actions);

  const actionsWithTiming = plan.actions.map((actionResult, index) => {
    const actionInput = parsed.data.actions[index];
    if (!actionInput) {
      return {
        ...actionResult,
        timeEstimate: null,
      };
    }

    const actionsCompleted = actionInput.actionsCompleted ?? 1;
    const timeEstimate = actionInput.secondsPerAction
      ? estimateTimeToComplete(actionsCompleted, actionInput.secondsPerAction)
      : null;

    return {
      ...actionResult,
      timeEstimate,
    };
  });

  const allHaveTiming = parsed.data.actions.every(
    (action) => action.secondsPerAction !== undefined
  );

  const totalTime = allHaveTiming
    ? actionsWithTiming.reduce((total, actionResult) => {
        if (!actionResult.timeEstimate) {
          return total;
        }

        return total + actionResult.timeEstimate.estimatedSeconds;
      }, 0)
    : null;

  const targetResult =
    parsed.data.targetXp !== undefined
      ? calculateXpToTargetXp(plan.endXp, parsed.data.targetXp)
      : parsed.data.targetLevel !== undefined
        ? calculateXpToLevel(plan.endXp, parsed.data.targetLevel)
        : null;

  return NextResponse.json({
    data: {
      ...plan,
      actions: actionsWithTiming,
      totalTimeSeconds: totalTime,
    },
    target: targetResult,
  });
}
