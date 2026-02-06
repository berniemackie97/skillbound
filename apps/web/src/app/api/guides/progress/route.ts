import {
  and,
  eq,
  guideProgress,
  guideTemplates,
  userCharacters,
} from '@skillbound/database';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createProblemDetails } from '@/lib/api/problem-details';
import { getSessionUser } from '@/lib/auth/auth-helpers';
import { getDbClient } from '@/lib/db';

const payloadSchema = z.object({
  characterId: z.string().uuid(),
  templateId: z.string().uuid(),
  version: z.number().int().positive(),
  completedSteps: z.array(z.number().int().positive()).optional(),
  currentStep: z.number().int().min(0).optional(),
});

const querySchema = z.object({
  characterId: z.string().uuid(),
});

function normalizeSteps(steps: number[]): number[] {
  return Array.from(
    new Set(steps.filter((value) => Number.isFinite(value)))
  ).sort((a, b) => a - b);
}

export async function GET(request: NextRequest) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    const problem = createProblemDetails({
      status: 401,
      title: 'Authentication required',
      detail: 'Sign in to view guide progress.',
    });
    return NextResponse.json(problem, { status: problem.status });
  }

  const parsed = querySchema.safeParse({
    characterId: request.nextUrl.searchParams.get('characterId'),
  });
  if (!parsed.success) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid request',
      detail: 'Provide a valid character id.',
      errors: parsed.error.issues,
    });
    return NextResponse.json(problem, { status: problem.status });
  }

  const db = getDbClient();

  const [character] = await db
    .select()
    .from(userCharacters)
    .where(
      and(
        eq(userCharacters.id, parsed.data.characterId),
        eq(userCharacters.userId, sessionUser.id)
      )
    )
    .limit(1);

  if (!character) {
    const problem = createProblemDetails({
      status: 404,
      title: 'Character not found',
      detail: 'Unable to load guide progress for this character.',
    });
    return NextResponse.json(problem, { status: problem.status });
  }

  const entries = await db
    .select({
      guideTemplateId: guideProgress.guideTemplateId,
      guideVersion: guideProgress.guideVersion,
      completedSteps: guideProgress.completedSteps,
      currentStep: guideProgress.currentStep,
      updatedAt: guideProgress.updatedAt,
    })
    .from(guideProgress)
    .where(eq(guideProgress.userCharacterId, character.id));

  const response = NextResponse.json({ data: entries });
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  return response;
}

export async function PUT(request: NextRequest) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    const problem = createProblemDetails({
      status: 401,
      title: 'Authentication required',
      detail: 'Sign in to update guide progress.',
    });
    return NextResponse.json(problem, { status: problem.status });
  }

  const payload: unknown = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid progress payload',
      detail: 'Provide valid guide progress data.',
      errors: parsed.error.issues,
    });
    return NextResponse.json(problem, { status: problem.status });
  }

  const db = getDbClient();

  const [character] = await db
    .select()
    .from(userCharacters)
    .where(
      and(
        eq(userCharacters.id, parsed.data.characterId),
        eq(userCharacters.userId, sessionUser.id)
      )
    )
    .limit(1);

  if (!character) {
    const problem = createProblemDetails({
      status: 404,
      title: 'Character not found',
      detail: 'Unable to update guide progress for this character.',
    });
    return NextResponse.json(problem, { status: problem.status });
  }

  const [template] = await db
    .select()
    .from(guideTemplates)
    .where(eq(guideTemplates.id, parsed.data.templateId))
    .limit(1);

  if (!template || template.version !== parsed.data.version) {
    const problem = createProblemDetails({
      status: 404,
      title: 'Guide not found',
      detail: 'Guide template or version does not exist.',
    });
    return NextResponse.json(problem, { status: problem.status });
  }

  const [progress] = await db
    .select()
    .from(guideProgress)
    .where(
      and(
        eq(guideProgress.userCharacterId, character.id),
        eq(guideProgress.guideTemplateId, template.id),
        eq(guideProgress.guideVersion, template.version)
      )
    )
    .limit(1);

  if (!progress) {
    const problem = createProblemDetails({
      status: 404,
      title: 'Guide not imported',
      detail: 'Import this guide before updating progress.',
    });
    return NextResponse.json(problem, { status: problem.status });
  }

  const update: Partial<typeof guideProgress.$inferInsert> = {};
  if (parsed.data.completedSteps) {
    const normalized = normalizeSteps(parsed.data.completedSteps);
    update.completedSteps = normalized;
    update.completedAt =
      normalized.length >= template.steps.length ? new Date() : null;
  }
  if (parsed.data.currentStep !== undefined) {
    update.currentStep = parsed.data.currentStep;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ data: progress });
  }

  const [updated] = await db
    .update(guideProgress)
    .set(update)
    .where(eq(guideProgress.id, progress.id))
    .returning();

  return NextResponse.json({ data: updated });
}
