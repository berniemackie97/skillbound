import Link from 'next/link';

import { GuideImportButton } from '@/components/guides/guide-import-button';
import { SignInModalButton } from '@/components/auth/sign-in-modal-button';
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

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Guides & progression paths</h2>
          <p>
            Import a guide to track steps per character. Guides are stored as
            curated templates you can resume anytime.
          </p>
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
          <h4>Sign in to track progress</h4>
          <p>
            You can browse guides without an account, but importing and tracking
            steps requires a saved character.
          </p>
          <SignInModalButton className="button ghost" label="Sign in" />
        </div>
      )}

      {user && !activeCharacter && (
        <div className="callout">
          <h4>Select an active character</h4>
          <p>
            Choose a saved character from the dropdown to import guides and
            record progress.
          </p>
          <Link className="button ghost" href="/characters">
            Manage characters
          </Link>
        </div>
      )}

      <div className="panel-grid guide-grid">
        {templates.map((template) => {
          const entry = progressMap.get(template.id);
          const stepCount = template.steps.length;
          const completedCount = entry?.completedSteps?.length ?? 0;
          const percent =
            stepCount > 0 ? Math.round((completedCount / stepCount) * 100) : 0;

          return (
            <article key={template.id} className="guide-card">
              <div className="guide-card-body">
                <div>
                  <h3>{template.title}</h3>
                  <p className="guide-description">{template.description}</p>
                </div>

                {template.tags && template.tags.length > 0 && (
                  <div className="guide-tags">
                    {template.tags.map((tag) => (
                      <span key={tag} className="guide-tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <div className="guide-meta">
                  <span>{stepCount} steps</span>
                  <span>
                    {completedCount} complete ({percent}%)
                  </span>
                </div>
                <div className="progress-track">
                  <div
                    className="progress-bar"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <div className="guide-actions">
                  <Link className="button ghost" href={`/guides/${template.id}`}>
                    Open guide
                  </Link>
                  {user && activeCharacter && !entry && (
                    <GuideImportButton
                      characterId={activeCharacter.id}
                      templateId={template.id}
                    />
                  )}
                  {entry && <span className="pill subtle">Tracking active</span>}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
