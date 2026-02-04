import {
  and,
  characterOverrides,
  eq,
  overrideTypeEnum,
  userCharacters,
} from '@skillbound/database';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getDbClient } from '@/lib/db';
import { createProblemDetails } from '@/lib/api/problem-details';

const paramsSchema = z.object({
  id: z.string().uuid(),
});

type RouteParams = Promise<{ id?: string }>;

const overrideTypeValues = overrideTypeEnum.enumValues as [
  (typeof overrideTypeEnum.enumValues)[number],
  ...(typeof overrideTypeEnum.enumValues)[number][],
];

const overrideSchema = z.object({
  type: z.enum(overrideTypeValues),
  key: z.string().min(1),
  value: z.union([z.boolean(), z.null()]),
  note: z.string().min(1).max(500).optional(),
});

const payloadSchema = z.object({
  overrides: z.array(overrideSchema).min(1),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: RouteParams }
) {
  const resolvedParams = await params;
  const parsedParams = paramsSchema.safeParse(resolvedParams);
  if (!parsedParams.success) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid character id',
      detail: 'Character id must be a valid UUID.',
    });

    return NextResponse.json(problem, { status: problem.status });
  }

  const db = getDbClient();
  const [character] = await db
    .select()
    .from(userCharacters)
    .where(eq(userCharacters.id, parsedParams.data.id))
    .limit(1);

  if (!character) {
    const problem = createProblemDetails({
      status: 404,
      title: 'Character not found',
      detail: 'No character exists for the supplied id.',
    });

    return NextResponse.json(problem, { status: problem.status });
  }

  const overrides = await db
    .select()
    .from(characterOverrides)
    .where(eq(characterOverrides.userCharacterId, parsedParams.data.id));

  return NextResponse.json({
    data: overrides,
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: RouteParams }
) {
  const resolvedParams = await params;
  const parsedParams = paramsSchema.safeParse(resolvedParams);
  if (!parsedParams.success) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid character id',
      detail: 'Character id must be a valid UUID.',
    });

    return NextResponse.json(problem, { status: problem.status });
  }

  const payload = (await request.json().catch(() => null)) as unknown;
  const parsedPayload = payloadSchema.safeParse(payload);
  if (!parsedPayload.success) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid overrides payload',
      detail: 'Overrides payload did not match expected schema.',
      errors: parsedPayload.error.issues,
    });

    return NextResponse.json(problem, { status: problem.status });
  }

  const db = getDbClient();
  const [character] = await db
    .select()
    .from(userCharacters)
    .where(eq(userCharacters.id, parsedParams.data.id))
    .limit(1);

  if (!character) {
    const problem = createProblemDetails({
      status: 404,
      title: 'Character not found',
      detail: 'No character exists for the supplied id.',
    });

    return NextResponse.json(problem, { status: problem.status });
  }

  for (const override of parsedPayload.data.overrides) {
    if (override.value === null) {
      await db
        .delete(characterOverrides)
        .where(
          and(
            eq(characterOverrides.userCharacterId, parsedParams.data.id),
            eq(characterOverrides.type, override.type),
            eq(characterOverrides.key, override.key)
          )
        );
      continue;
    }

    await db
      .insert(characterOverrides)
      .values({
        userCharacterId: parsedParams.data.id,
        type: override.type,
        key: override.key,
        value: override.value,
        note: override.note ?? null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [
          characterOverrides.userCharacterId,
          characterOverrides.type,
          characterOverrides.key,
        ],
        set: {
          value: override.value,
          note: override.note ?? null,
          updatedAt: new Date(),
        },
      });
  }

  const overrides = await db
    .select()
    .from(characterOverrides)
    .where(eq(characterOverrides.userCharacterId, parsedParams.data.id));

  return NextResponse.json({
    data: overrides,
  });
}
