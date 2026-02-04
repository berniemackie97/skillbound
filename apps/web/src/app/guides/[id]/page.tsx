import { characterOverrides, eq } from '@skillbound/database';
import { notFound } from 'next/navigation';

import { GuideImportButton } from '@/components/guides/guide-import-button';
import {
  GuideStepList,
  type GuideChapterView,
  type GuideSectionView,
} from '@/components/guides/guide-step-list';
import { getSessionUser } from '@/lib/auth/auth-helpers';
import { getActiveCharacter } from '@/lib/character/character-selection';
import { getLatestCharacterSnapshot } from '@/lib/character/character-snapshots';
import { getDbClient } from '@/lib/db';
import { getGuideProgressRecord } from '@/lib/guides/guide-progress';
import { evaluateGuideStepRequirements } from '@/lib/guides/guide-requirements';
import { getGuideTemplateById } from '@/lib/guides/guide-templates';
import { buildCharacterFactsFromSnapshot } from '@/lib/requirements/requirements-context';
import { toProgressSnapshot } from '@/lib/snapshots/snapshots';

type GuideDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function GuideDetailPage({
  params,
}: GuideDetailPageProps) {
  const resolvedParams = await params;
  const template = await getGuideTemplateById(resolvedParams.id);
  if (!template) {
    notFound();
  }

  const user = await getSessionUser();
  const activeSelection = user ? await getActiveCharacter(user.id) : null;
  const activeCharacter = activeSelection?.character ?? null;

  const progress =
    activeCharacter && user
      ? await getGuideProgressRecord(
          activeCharacter.id,
          template.id,
          template.version
        )
      : null;

  let facts = null;
  if (activeCharacter) {
    const snapshot = await getLatestCharacterSnapshot(activeCharacter.id);
    if (snapshot) {
      const db = getDbClient();
      const overrides = await db
        .select()
        .from(characterOverrides)
        .where(eq(characterOverrides.userCharacterId, activeCharacter.id));
      const progressSnapshot = toProgressSnapshot(snapshot);
      facts = buildCharacterFactsFromSnapshot(
        progressSnapshot.skills,
        overrides,
        progressSnapshot.activities
      );
    }
  }

  const chapters: GuideChapterView[] = [];
  const chapterMap = new Map<string, GuideChapterView>();
  const sectionMap = new Map<string, GuideSectionView>();

  for (const step of template.steps) {
    const evaluation = evaluateGuideStepRequirements(step, facts);
    const section = step.section ?? null;
    const chapterTitle = section?.chapterTitle?.trim() || 'Guide steps';
    const sectionId = section?.id ?? 'ungrouped';
    const sectionKey = `${chapterTitle}::${sectionId}`;

    let chapter = chapterMap.get(chapterTitle);
    if (!chapter) {
      chapter = { title: chapterTitle, sections: [] };
      chapterMap.set(chapterTitle, chapter);
      chapters.push(chapter);
    }

    let sectionView = sectionMap.get(sectionKey);
    if (!sectionView) {
      sectionView = {
        id: sectionId,
        title: section?.title ?? 'Ungrouped steps',
        description: section?.description ?? '',
        chapterTitle,
        steps: [],
      };
      sectionMap.set(sectionKey, sectionView);
      chapter.sections.push(sectionView);
    }

    sectionView.steps.push({
      stepNumber: step.stepNumber,
      title: step.title,
      ...(step.instructions && step.instructions.length > 0
        ? { instructions: step.instructions }
        : {}),
      status: evaluation.status,
      required: evaluation.required,
      optional: evaluation.optional,
      ...(step.meta ? { meta: step.meta } : {}),
    });
  }

  return (
    <section className="panel guide-detail">
      <div className="panel-header">
        <div>
          <h2>{template.title}</h2>
          <p>{template.description}</p>
        </div>
        {activeCharacter && (
          <div className="pill-group">
            <span className="pill subtle">Active character</span>
            <span className="pill">{activeCharacter.displayName}</span>
          </div>
        )}
      </div>

      {!user && (
        <div className="callout">
          <h4>Sign in to track this guide</h4>
          <p>Progress tracking is only available for saved characters.</p>
        </div>
      )}

      {user && !activeCharacter && (
        <div className="callout">
          <h4>Select an active character</h4>
          <p>Choose a character to import the guide and track steps.</p>
        </div>
      )}

      {user && activeCharacter && !progress && (
        <div className="callout">
          <h4>Import this guide</h4>
          <p>
            Importing creates a per-character checklist. You can toggle steps as
            you complete them.
          </p>
          <GuideImportButton
            characterId={activeCharacter.id}
            templateId={template.id}
          />
        </div>
      )}

      <GuideStepList
        chapters={chapters}
        characterId={activeCharacter?.id ?? null}
        initialCompleted={progress?.completedSteps ?? []}
        isImported={Boolean(progress)}
        templateId={template.id}
        version={template.version}
      />
    </section>
  );
}
