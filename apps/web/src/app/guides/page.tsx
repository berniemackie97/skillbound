import Link from 'next/link';

import { GuidesClient } from '@/components/guides/guides-client';
import { getSessionUser } from '@/lib/auth/auth-helpers';
import { getActiveCharacter } from '@/lib/character/character-selection';
import { getGuideProgressForCharacter } from '@/lib/guides/guide-progress';
import { getPublishedGuideTemplates } from '@/lib/guides/guide-templates';

export default async function GuidesPage() {
  const user = await getSessionUser();
  const activeSelection = user ? await getActiveCharacter(user.id) : null;
  const activeCharacter = activeSelection?.character ?? null;
  const templates = await getPublishedGuideTemplates();
  const progress = activeCharacter
    ? await getGuideProgressForCharacter(activeCharacter.id)
    : [];

  const progressMap = new Map(
    progress.map((entry) => [entry.guideTemplateId, entry])
  );

  // Get unique tags for filtering
  const allTags = [...new Set(templates.flatMap((t) => t.tags ?? []))].sort();

  // Transform templates with progress data for the client
  const guidesWithProgress = templates.map((template) => {
    const entry = progressMap.get(template.id);
    const stepCount = template.steps.length;
    const completedCount = entry?.completedSteps?.length ?? 0;

    return {
      id: template.id,
      title: template.title,
      description: template.description,
      tags: template.tags ?? [],
      stepCount,
      completedCount,
      recommendedModes: template.recommendedModes ?? [],
      isTracking: Boolean(entry),
      isCompleted: completedCount >= stepCount && stepCount > 0,
    };
  });

  return (
    <div className="guides-page">
      {/* Page Header */}
      <header className="guides-header">
        <div className="guides-header-content">
          <h1>Guides</h1>
          <p>Curated progression paths to efficiently level your account</p>
        </div>
        {activeCharacter ? (
          <div className="guides-character-badge">
            <svg
              fill="none"
              height="16"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
              width="16"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            {activeCharacter.displayName}
          </div>
        ) : user ? (
          <Link className="guides-character-link" href="/characters">
            Select a character
          </Link>
        ) : null}
      </header>

      {/* Main Panel with Gold Border */}
      <div className="guides-panel">
        <GuidesClient
          activeCharacterId={activeCharacter?.id ?? null}
          allTags={allTags}
          guides={guidesWithProgress}
          isLoggedIn={Boolean(user)}
        />
      </div>
    </div>
  );
}
