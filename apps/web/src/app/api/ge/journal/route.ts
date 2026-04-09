/**
 * POST /api/ge/journal/analyze
 *
 * Accepts an array of journal entries and returns behavioural analysis:
 * outcome breakdown, tag frequency, confidence bias, emotional trade
 * rate, and planned trade win rate.
 *
 * Journal entries are stored client-side or in user settings; this
 * endpoint provides the analysis engine only.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createProblemDetails } from '@/lib/api/problem-details';
import {
  analyzeJournal,
  searchJournal,
  filterByTags,
  type JournalEntry,
  type JournalTag,
} from '@/lib/trading/trade-journal';

export const dynamic = 'force-dynamic';

const journalEntrySchema = z.object({
  id: z.string(),
  tradeId: z.string().optional(),
  itemId: z.number().int().positive().optional(),
  itemName: z.string().optional(),
  title: z.string().min(1),
  body: z.string(),
  outcome: z.enum(['profit', 'loss', 'breakeven', 'pending']),
  confidenceBefore: z.number().int().min(1).max(5).optional(),
  confidenceAfter: z.number().int().min(1).max(5).optional(),
  tags: z.array(
    z.enum([
      'flip',
      'investment',
      'panic-sell',
      'fomo-buy',
      'planned',
      'impulse',
      'news-driven',
      'technical',
      'fundamental',
      'lesson-learned',
    ])
  ),
  profitLoss: z.number().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

const requestSchema = z.object({
  entries: z.array(journalEntrySchema).min(1).max(1000),
  search: z.string().optional(),
  filterTags: z
    .array(
      z.enum([
        'flip',
        'investment',
        'panic-sell',
        'fomo-buy',
        'planned',
        'impulse',
        'news-driven',
        'technical',
        'fundamental',
        'lesson-learned',
      ])
    )
    .optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      const problem = createProblemDetails({
        status: 400,
        title: 'Invalid journal data',
        detail: 'Provide { entries: [...] } with valid journal entries.',
        errors: parsed.error.issues,
        instance: request.nextUrl.pathname,
      });
      return NextResponse.json(problem, { status: problem.status });
    }

    let entries = parsed.data.entries as JournalEntry[];

    // Apply filters if provided
    if (parsed.data.search) {
      entries = searchJournal(entries, parsed.data.search);
    }
    if (parsed.data.filterTags && parsed.data.filterTags.length > 0) {
      entries = filterByTags(entries, parsed.data.filterTags as JournalTag[]);
    }

    const analysis = analyzeJournal(entries);

    return NextResponse.json({
      data: {
        analysis,
        filteredCount: entries.length,
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to analyze journal' },
      { status: 500 }
    );
  }
}
