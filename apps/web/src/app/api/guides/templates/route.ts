import { desc, eq, guideTemplates } from '@skillbound/database';
import { NextResponse } from 'next/server';

import { getDbClient } from '@/lib/db';
import { ensureGuideTemplates } from '@/lib/guides/guide-templates';

export async function GET() {
  await ensureGuideTemplates();
  const db = getDbClient();
  const templates = await db
    .select()
    .from(guideTemplates)
    .where(eq(guideTemplates.status, 'published'))
    .orderBy(desc(guideTemplates.publishedAt));

  const payload = templates.map((template) => ({
    id: template.id,
    title: template.title,
    description: template.description,
    version: template.version,
    status: template.status,
    recommendedModes: template.recommendedModes,
    tags: template.tags,
    publishedAt: template.publishedAt,
    stepCount: template.steps.length,
    firstStepMeta: template.steps[0]?.meta ?? null,
  }));

  return NextResponse.json({ data: payload });
}
