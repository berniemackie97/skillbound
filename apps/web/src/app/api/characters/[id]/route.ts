import { and, eq, userCharacters, userSettings } from '@skillbound/database';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createProblemDetails } from '@/lib/api/problem-details';
import { getSessionUser, unauthorizedResponse } from '@/lib/auth/auth-helpers';
import { getDbClient } from '@/lib/db';

const paramsSchema = z.object({
  id: z.string().uuid(),
});

type RouteParams = Promise<{ id?: string }>;

const updateSchema = z.object({
  tags: z.array(z.string().trim().min(1).max(32)).max(25).optional(),
  notes: z.string().max(2000).nullable().optional(),
  isPublic: z.boolean().optional(),
  archived: z.boolean().optional(),
});

function parseTags(input: unknown): string[] | undefined {
  if (typeof input === 'string') {
    const tags = input
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
    return tags.length > 0 ? tags : [];
  }
  if (Array.isArray(input)) {
    return input
      .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
      .filter((tag) => tag.length > 0);
  }
  return undefined;
}

async function readPayload(request: NextRequest) {
  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return null;
  }

  return {
    tags: formData.get('tags'),
    notes: formData.get('notes'),
    isPublic: formData.get('isPublic'),
    archived: formData.get('archived'),
  };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: RouteParams }
) {
  const user = await getSessionUser();
  if (!user) {
    return unauthorizedResponse();
  }

  const resolvedParams = await params;
  const parsedParams = paramsSchema.safeParse(resolvedParams);
  if (!parsedParams.success) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid character id',
      detail: 'Character id must be a valid UUID.',
      errors: parsedParams.error.issues,
    });
    return NextResponse.json(problem, { status: problem.status });
  }

  const payload = await readPayload(request);
  if (!payload) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid payload',
      detail: 'Provide fields to update.',
    });
    return NextResponse.json(problem, { status: problem.status });
  }

  const tags = parseTags(payload['tags']);
  const notes =
    typeof payload['notes'] === 'string'
      ? payload['notes'].trim() || null
      : payload['notes'] === null
        ? null
        : undefined;
  const isPublic =
    typeof payload['isPublic'] === 'boolean'
      ? payload['isPublic']
      : typeof payload['isPublic'] === 'string'
        ? payload['isPublic'] === 'true'
        : undefined;
  const archived =
    typeof payload['archived'] === 'boolean'
      ? payload['archived']
      : typeof payload['archived'] === 'string'
        ? payload['archived'] === 'true'
        : undefined;

  const parsedUpdate = updateSchema.safeParse({
    tags,
    notes,
    isPublic,
    archived,
  });

  if (!parsedUpdate.success) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid update payload',
      detail: 'Tags, notes, or visibility are invalid.',
      errors: parsedUpdate.error.issues,
    });
    return NextResponse.json(problem, { status: problem.status });
  }

  if (
    parsedUpdate.data.tags === undefined &&
    parsedUpdate.data.notes === undefined &&
    parsedUpdate.data.isPublic === undefined &&
    parsedUpdate.data.archived === undefined
  ) {
    const problem = createProblemDetails({
      status: 400,
      title: 'No updates provided',
      detail: 'Provide tags, notes, or visibility updates.',
    });
    return NextResponse.json(problem, { status: problem.status });
  }

  const db = getDbClient();
  const [character] = await db
    .select()
    .from(userCharacters)
    .where(
      and(
        eq(userCharacters.id, parsedParams.data.id),
        eq(userCharacters.userId, user.id)
      )
    )
    .limit(1);

  if (!character) {
    const problem = createProblemDetails({
      status: 404,
      title: 'Character not found',
      detail: 'No saved character exists for that id.',
    });
    return NextResponse.json(problem, { status: problem.status });
  }

  const updateValues: Partial<typeof userCharacters.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (parsedUpdate.data.tags !== undefined) {
    updateValues.tags = parsedUpdate.data.tags;
  }
  if (parsedUpdate.data.notes !== undefined) {
    updateValues.notes = parsedUpdate.data.notes;
  }
  if (parsedUpdate.data.isPublic !== undefined) {
    updateValues.isPublic = parsedUpdate.data.isPublic;
  }
  if (parsedUpdate.data.archived !== undefined) {
    updateValues.archivedAt = parsedUpdate.data.archived ? new Date() : null;
  }

  const [updated] = await db
    .update(userCharacters)
    .set(updateValues)
    .where(eq(userCharacters.id, character.id))
    .returning();

  if (parsedUpdate.data.archived === true) {
    await db
      .update(userSettings)
      .set({ activeCharacterId: null, updatedAt: new Date() })
      .where(
        and(
          eq(userSettings.userId, user.id),
          eq(userSettings.activeCharacterId, character.id)
        )
      );
  }

  const responsePayload = { data: updated };
  const accept = request.headers.get('accept') ?? '';
  if (accept.includes('text/html')) {
    const redirectTo = request.headers.get('referer') ?? '/characters';
    return NextResponse.redirect(redirectTo, { status: 303 });
  }

  return NextResponse.json(responsePayload);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: RouteParams }
) {
  const user = await getSessionUser();
  if (!user) {
    return unauthorizedResponse();
  }

  const resolvedParams = await params;
  const parsedParams = paramsSchema.safeParse(resolvedParams);
  if (!parsedParams.success) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid character id',
      detail: 'Character id must be a valid UUID.',
      errors: parsedParams.error.issues,
    });
    return NextResponse.json(problem, { status: problem.status });
  }

  const db = getDbClient();
  const [character] = await db
    .select()
    .from(userCharacters)
    .where(
      and(
        eq(userCharacters.id, parsedParams.data.id),
        eq(userCharacters.userId, user.id)
      )
    )
    .limit(1);

  if (!character) {
    const problem = createProblemDetails({
      status: 404,
      title: 'Character not found',
      detail: 'No saved character exists for that id.',
    });
    return NextResponse.json(problem, { status: problem.status });
  }

  await db.delete(userCharacters).where(eq(userCharacters.id, character.id));
  await db
    .update(userSettings)
    .set({ activeCharacterId: null, updatedAt: new Date() })
    .where(
      and(
        eq(userSettings.userId, user.id),
        eq(userSettings.activeCharacterId, character.id)
      )
    );

  const responsePayload = { data: { deleted: true } };
  const accept = request.headers.get('accept') ?? '';
  if (accept.includes('text/html')) {
    const redirectTo = request.headers.get('referer') ?? '/characters';
    return NextResponse.redirect(redirectTo, { status: 303 });
  }

  return NextResponse.json(responsePayload);
}
