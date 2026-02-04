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

import { getSessionUser } from '@/lib/auth/auth-helpers';
import { getDbClient } from '@/lib/db';
import { ensureGuideTemplates } from '@/lib/guides/guide-templates';
import { createProblemDetails } from '@/lib/api/problem-details';

const payloadSchema = z.object({
  characterId: z.string().uuid(),
  templateId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    const problem = createProblemDetails({
      status: 401,
      title: 'Authentication required',
      detail: 'Sign in to import guides.',
    });
    return NextResponse.json(problem, { status: problem.status });
  }

  const payload: unknown = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid import payload',
      detail: 'Provide a valid character and guide template id.',
      errors: parsed.error.issues,
    });
    return NextResponse.json(problem, { status: problem.status });
  }

  await ensureGuideTemplates();
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
      detail: 'Unable to import guide for this character.',
    });
    return NextResponse.json(problem, { status: problem.status });
  }

  const [template] = await db
    .select()
    .from(guideTemplates)
    .where(eq(guideTemplates.id, parsed.data.templateId))
    .limit(1);

  if (!template) {
    const problem = createProblemDetails({
      status: 404,
      title: 'Guide not found',
      detail: 'Selected guide template does not exist.',
    });
    return NextResponse.json(problem, { status: problem.status });
  }

  const [existing] = await db
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

  if (existing) {
    return NextResponse.json({ data: existing });
  }

  const [created] = await db
    .insert(guideProgress)
    .values({
      userCharacterId: character.id,
      guideTemplateId: template.id,
      guideVersion: template.version,
      completedSteps: [],
      currentStep: 0,
      startedAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  return NextResponse.json({ data: created });
}
