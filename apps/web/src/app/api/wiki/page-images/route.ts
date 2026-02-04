import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createProblemDetails } from '@/lib/api/problem-details';

const querySchema = z.object({
  titles: z.string().min(1),
  size: z
    .string()
    .optional()
    .transform((value) => {
      if (!value) return 48;
      const parsed = Number.parseInt(value, 10);
      return Number.isFinite(parsed) ? parsed : 48;
    }),
});

const MAX_TITLES = 50;

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse({
    titles: request.nextUrl.searchParams.get('titles') ?? undefined,
    size: request.nextUrl.searchParams.get('size') ?? undefined,
  });

  if (!parsed.success) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid request',
      detail: 'Missing or invalid titles query.',
      errors: parsed.error.issues,
      instance: request.nextUrl.pathname,
    });

    return NextResponse.json(problem, { status: problem.status });
  }

  const titles = parsed.data.titles
    .split(',')
    .map((title) => title.trim())
    .filter(Boolean)
    .slice(0, MAX_TITLES);

  if (titles.length === 0) {
    const problem = createProblemDetails({
      status: 400,
      title: 'Invalid request',
      detail: 'No titles provided.',
      instance: request.nextUrl.pathname,
    });

    return NextResponse.json(problem, { status: problem.status });
  }

  const params = new URLSearchParams({
    action: 'query',
    titles: titles.join('|'),
    prop: 'pageimages',
    piprop: 'thumbnail',
    pithumbsize: String(parsed.data.size),
    format: 'json',
  });

  const userAgent =
    process.env['SKILLBOUND_USER_AGENT'] ??
    process.env['INTEGRATIONS_USER_AGENT'] ??
    'Skillbound';

  try {
    const response = await fetch(
      `https://oldschool.runescape.wiki/api.php?${params.toString()}`,
      {
        headers: {
          'User-Agent': userAgent,
          Accept: 'application/json',
        },
      }
    );

    if (!response.ok) {
      const problem = createProblemDetails({
        status: 502,
        title: 'Wiki fetch failed',
        detail: `Wiki responded with ${response.status}.`,
        instance: request.nextUrl.pathname,
      });

      return NextResponse.json(problem, { status: problem.status });
    }

    const data = (await response.json()) as {
      query?: {
        pages?: Record<
          string,
          { title: string; thumbnail?: { source?: string } }
        >;
      };
    };

    const pages = data.query?.pages ?? {};
    const payload = Object.values(pages).map((page) => ({
      title: page.title,
      url: page.thumbnail?.source ?? null,
    }));

    return NextResponse.json({ data: payload });
  } catch (error) {
    const problem = createProblemDetails({
      status: 502,
      title: 'Wiki fetch failed',
      detail:
        error instanceof Error ? error.message : 'Unable to fetch wiki images.',
      instance: request.nextUrl.pathname,
    });

    return NextResponse.json(problem, { status: problem.status });
  }
}
