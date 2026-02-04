import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionUser, unauthorizedResponse } from '@/lib/auth/auth-helpers';
import {
  deleteState,
  getCharacterStateSummary,
  getDomainState,
  getState,
  getStates,
  setState,
  setStates,
  verifyCharacterOwnership,
  type BatchStateUpdate,
  type GetStateOptions,
  type SetStateOptions,
  type StateDomain,
  type StateSource,
} from '@/lib/character/character-state-service';
import { createProblemDetails } from '@/lib/api/problem-details';

const paramsSchema = z.object({
  id: z.string().uuid(),
});

type RouteParams = Promise<{ id?: string }>;

const domainSchema = z.enum([
  'skill',
  'boss',
  'activity',
  'quest',
  'diary',
  'diary_task',
  'combat_achievement',
  'collection_log',
  'item_unlock',
  'gear',
  'guide_step',
  'milestone',
  'goal',
  'unlock_flag',
  'custom',
]);

const sourceSchema = z.enum([
  'hiscores',
  'runelite',
  'wiki',
  'guide',
  'manual',
  'calculated',
  'migration',
]);

const confidenceSchema = z.enum(['high', 'medium', 'low']);

const setStateSchema = z.object({
  domain: domainSchema,
  key: z.string().min(1).max(255),
  value: z.record(z.string(), z.unknown()),
  source: sourceSchema.optional(),
  sourceId: z.string().max(255).optional(),
  confidence: confidenceSchema.optional(),
  note: z.string().max(1000).optional(),
  achievedAt: z.string().datetime().optional(),
  force: z.boolean().optional(),
});

const batchSetStateSchema = z.object({
  updates: z.array(setStateSchema).min(1).max(100),
});

const deleteStateSchema = z.object({
  domain: domainSchema,
  key: z.string().min(1).max(255),
});

/**
 * GET /api/characters/[id]/state
 *
 * Query character state
 *
 * Query parameters:
 * - domain: Filter by domain (optional, can be repeated)
 * - source: Filter by source (optional)
 * - achievedOnly: Only return achieved/completed items (optional)
 * - key: Get a specific state entry by domain+key (requires domain)
 * - summary: Return summary statistics instead of raw state
 */
export async function GET(
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

  const characterId = parsedParams.data.id;

  // Verify ownership
  const isOwner = await verifyCharacterOwnership(characterId, user.id);
  if (!isOwner) {
    const problem = createProblemDetails({
      status: 404,
      title: 'Character not found',
      detail: 'No saved character exists for that id.',
    });
    return NextResponse.json(problem, { status: problem.status });
  }

  const searchParams = request.nextUrl.searchParams;
  const summaryMode = searchParams.get('summary') === 'true';

  // Return summary if requested
  if (summaryMode) {
    try {
      const summary = await getCharacterStateSummary(characterId);
      return NextResponse.json({ data: summary });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      const problem = createProblemDetails({
        status: 500,
        title: 'Failed to get state summary',
        detail: errorMessage,
      });
      return NextResponse.json(problem, { status: problem.status });
    }
  }

  // Parse query options
  const domainParam = searchParams.get('domain');
  const domains = domainParam
    ? domainParam.split(',').filter((d) => domainSchema.safeParse(d).success)
    : undefined;
  const sourceParam = searchParams.get('source');
  const source = sourceParam && sourceSchema.safeParse(sourceParam).success
    ? (sourceParam as StateSource)
    : undefined;
  const achievedOnly = searchParams.get('achievedOnly') === 'true';
  const key = searchParams.get('key');

  // Get specific state entry
  if (key && domains && domains.length === 1) {
    try {
      const state = await getState(characterId, domains[0] as StateDomain, key);
      if (!state) {
        const problem = createProblemDetails({
          status: 404,
          title: 'State not found',
          detail: `No state entry found for domain=${domains[0]}, key=${key}`,
        });
        return NextResponse.json(problem, { status: problem.status });
      }
      return NextResponse.json({ data: state });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      const problem = createProblemDetails({
        status: 500,
        title: 'Failed to get state',
        detail: errorMessage,
      });
      return NextResponse.json(problem, { status: problem.status });
    }
  }

  // Get domain state if single domain specified without key
  if (domains && domains.length === 1 && !key) {
    try {
      const states = await getDomainState(characterId, domains[0] as StateDomain);
      return NextResponse.json({
        data: states,
        meta: { count: states.length, domain: domains[0] },
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      const problem = createProblemDetails({
        status: 500,
        title: 'Failed to get domain state',
        detail: errorMessage,
      });
      return NextResponse.json(problem, { status: problem.status });
    }
  }

  // Get states with filters
  try {
    const options: GetStateOptions = {
      domains: domains as StateDomain[] | undefined,
      source,
      achievedOnly,
    };

    const states = await getStates(characterId, options);
    return NextResponse.json({
      data: states,
      meta: { count: states.length },
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    const problem = createProblemDetails({
      status: 500,
      title: 'Failed to get states',
      detail: errorMessage,
    });
    return NextResponse.json(problem, { status: problem.status });
  }
}

/**
 * POST /api/characters/[id]/state
 *
 * Set character state (single or batch)
 *
 * Body (single):
 * {
 *   domain: "quest",
 *   key: "dragon_slayer",
 *   value: { completed: true },
 *   source?: "manual",
 *   ...
 * }
 *
 * Body (batch):
 * {
 *   updates: [
 *     { domain: "quest", key: "dragon_slayer", value: { completed: true } },
 *     { domain: "unlock_flag", key: "fairy_rings", value: { unlocked: true } }
 *   ]
 * }
 */
export async function POST(
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

  const characterId = parsedParams.data.id;

  // Verify ownership
  const isOwner = await verifyCharacterOwnership(characterId, user.id);
  if (!isOwner) {
    const problem = createProblemDetails({
      status: 404,
      title: 'Character not found',
      detail: 'No saved character exists for that id.',
    });
    return NextResponse.json(problem, { status: problem.status });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid JSON',
      detail: 'Request body must be valid JSON.',
    });
    return NextResponse.json(problem, { status: problem.status });
  }

  // Try batch format first
  const batchParsed = batchSetStateSchema.safeParse(body);
  if (batchParsed.success) {
    try {
      const updates: BatchStateUpdate[] = batchParsed.data.updates.map((u) => ({
        domain: u.domain,
        key: u.key,
        value: u.value,
        options: {
          source: u.source,
          sourceId: u.sourceId,
          confidence: u.confidence,
          note: u.note,
          achievedAt: u.achievedAt ? new Date(u.achievedAt) : undefined,
          force: u.force,
        } as SetStateOptions,
      }));

      const results = await setStates(characterId, updates);
      return NextResponse.json({
        data: results,
        meta: { count: results.length },
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      const problem = createProblemDetails({
        status: 500,
        title: 'Failed to set states',
        detail: errorMessage,
      });
      return NextResponse.json(problem, { status: problem.status });
    }
  }

  // Try single format
  const singleParsed = setStateSchema.safeParse(body);
  if (!singleParsed.success) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid payload',
      detail: 'Provide a valid state update or batch of updates.',
      errors: singleParsed.error.issues,
    });
    return NextResponse.json(problem, { status: problem.status });
  }

  try {
    const data = singleParsed.data;
    const options: SetStateOptions = {
      source: data.source,
      sourceId: data.sourceId,
      confidence: data.confidence,
      note: data.note,
      achievedAt: data.achievedAt ? new Date(data.achievedAt) : undefined,
      force: data.force,
    };

    const result = await setState(
      characterId,
      data.domain,
      data.key,
      data.value,
      options
    );

    return NextResponse.json({ data: result });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    const problem = createProblemDetails({
      status: 500,
      title: 'Failed to set state',
      detail: errorMessage,
    });
    return NextResponse.json(problem, { status: problem.status });
  }
}

/**
 * DELETE /api/characters/[id]/state
 *
 * Delete character state entry
 *
 * Body:
 * {
 *   domain: "quest",
 *   key: "dragon_slayer"
 * }
 */
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

  const characterId = parsedParams.data.id;

  // Verify ownership
  const isOwner = await verifyCharacterOwnership(characterId, user.id);
  if (!isOwner) {
    const problem = createProblemDetails({
      status: 404,
      title: 'Character not found',
      detail: 'No saved character exists for that id.',
    });
    return NextResponse.json(problem, { status: problem.status });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid JSON',
      detail: 'Request body must be valid JSON.',
    });
    return NextResponse.json(problem, { status: problem.status });
  }

  const parsed = deleteStateSchema.safeParse(body);
  if (!parsed.success) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid payload',
      detail: 'Provide domain and key to delete.',
      errors: parsed.error.issues,
    });
    return NextResponse.json(problem, { status: problem.status });
  }

  try {
    const deleted = await deleteState(
      characterId,
      parsed.data.domain,
      parsed.data.key
    );

    if (!deleted) {
      const problem = createProblemDetails({
        status: 404,
        title: 'State not found',
        detail: `No state entry found for domain=${parsed.data.domain}, key=${parsed.data.key}`,
      });
      return NextResponse.json(problem, { status: problem.status });
    }

    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    const problem = createProblemDetails({
      status: 500,
      title: 'Failed to delete state',
      detail: errorMessage,
    });
    return NextResponse.json(problem, { status: problem.status });
  }
}
