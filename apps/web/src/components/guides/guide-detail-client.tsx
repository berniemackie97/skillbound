'use client';

import type { GuideTemplateBundle } from '@skillbound/content';
import type { CharacterOverride } from '@skillbound/database';
import type { ProgressSnapshot } from '@skillbound/domain';
import { useEffect, useMemo, useState } from 'react';

import { buildGuideChapters } from '@/lib/guides/guide-view';
import { buildCharacterFactsFromSnapshot } from '@/lib/requirements/requirements-context';

import { GuideImportButton } from './guide-import-button';
import { GuideStepList, type GuideChapterView } from './guide-step-list';

type NavSessionResponse = {
  user: { id: string; name?: string | null; email?: string | null } | null;
  characters: Array<{ id: string; displayName: string; mode: string }>;
  activeCharacterId: string | null;
};

const emptySession: NavSessionResponse = {
  user: null,
  characters: [],
  activeCharacterId: null,
};

type GuideProgressEntry = {
  guideTemplateId: string;
  guideVersion: number;
  completedSteps: number[];
  currentStep?: number | null;
  updatedAt?: string | null;
};

type GuideDetailClientProps = {
  template: GuideTemplateBundle;
  initialChapters: GuideChapterView[];
};

export function GuideDetailClient({
  template,
  initialChapters,
}: GuideDetailClientProps) {
  const [session, setSession] = useState<NavSessionResponse>(emptySession);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [dbTemplateId, setDbTemplateId] = useState<string | null>(null);
  const [progress, setProgress] = useState<GuideProgressEntry | null>(null);
  const [chapters, setChapters] = useState<GuideChapterView[]>(initialChapters);

  const activeCharacter = useMemo(() => {
    if (!session.activeCharacterId) {
      return null;
    }
    return (
      session.characters.find(
        (character) => character.id === session.activeCharacterId
      ) ?? null
    );
  }, [session.activeCharacterId, session.characters]);

  useEffect(() => {
    let active = true;

    const loadSession = async () => {
      try {
        const response = await fetch('/api/nav/session', {
          cache: 'no-store',
        });
        if (!response.ok) {
          if (active) setSession(emptySession);
          return;
        }
        const payload = (await response.json()) as NavSessionResponse;
        if (active) {
          setSession({
            user: payload.user ?? null,
            characters: payload.characters ?? [],
            activeCharacterId: payload.activeCharacterId ?? null,
          });
        }
      } catch {
        if (active) setSession(emptySession);
      } finally {
        if (active) setIsLoadingSession(false);
      }
    };

    void loadSession();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const resolveTemplate = async () => {
      if (!session.user) {
        setDbTemplateId(null);
        return;
      }

      try {
        const response = await fetch('/api/guides/templates', {
          cache: 'no-store',
        });
        if (!response.ok) {
          if (active) setDbTemplateId(null);
          return;
        }
        const payload = (await response.json()) as {
          data?: Array<{ id: string; title: string; version: number }>;
        };
        const match = payload.data?.find(
          (entry) =>
            entry.title === template.title && entry.version === template.version
        );
        if (active) {
          setDbTemplateId(match?.id ?? null);
        }
      } catch {
        if (active) setDbTemplateId(null);
      }
    };

    void resolveTemplate();
    return () => {
      active = false;
    };
  }, [session.user, template.title, template.version]);

  useEffect(() => {
    let active = true;

    const loadCharacterData = async () => {
      if (!session.user || !session.activeCharacterId || !dbTemplateId) {
        return;
      }

      try {
        const [progressResponse, dashboardResponse, overridesResponse] =
          await Promise.all([
            fetch(
              `/api/guides/progress?characterId=${session.activeCharacterId}`,
              {
                cache: 'no-store',
              }
            ),
            fetch(`/api/characters/${session.activeCharacterId}/dashboard`, {
              cache: 'no-store',
            }),
            fetch(`/api/characters/${session.activeCharacterId}/overrides`, {
              cache: 'no-store',
            }),
          ]);

        if (!progressResponse.ok || !dashboardResponse.ok) {
          return;
        }

        const progressPayload = (await progressResponse.json()) as {
          data?: GuideProgressEntry[];
        };
        const dashboardPayload = (await dashboardResponse.json()) as {
          data?: { snapshot?: ProgressSnapshot | null };
        };
        const overridesPayload = overridesResponse.ok
          ? ((await overridesResponse.json()) as { data?: CharacterOverride[] })
          : { data: [] };

        const progressEntry =
          progressPayload.data?.find(
            (entry) =>
              entry.guideTemplateId === dbTemplateId &&
              entry.guideVersion === template.version
          ) ?? null;

        const snapshot = dashboardPayload.data?.snapshot ?? null;
        const overrides = overridesPayload.data ?? [];

        if (snapshot) {
          const facts = buildCharacterFactsFromSnapshot(
            snapshot.skills,
            overrides,
            snapshot.activities ?? null
          );
          const nextChapters = buildGuideChapters(template.steps, facts);
          if (active) {
            setChapters(nextChapters);
          }
        }

        if (active) {
          setProgress(progressEntry);
        }
      } catch {
        // Ignore personalization errors
      }
    };

    void loadCharacterData();
    return () => {
      active = false;
    };
  }, [dbTemplateId, session.activeCharacterId, session.user, template]);

  const resolvedTemplateId = dbTemplateId ?? template.id;
  const guideKey = `${resolvedTemplateId}-${session.activeCharacterId ?? 'guest'}-${
    progress?.updatedAt ?? 'baseline'
  }`;

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

      {!isLoadingSession && !session.user && (
        <div className="callout">
          <h4>Sign in to track this guide</h4>
          <p>Progress tracking is only available for saved characters.</p>
        </div>
      )}

      {!isLoadingSession && session.user && !activeCharacter && (
        <div className="callout">
          <h4>Select an active character</h4>
          <p>Choose a character to import the guide and track steps.</p>
        </div>
      )}

      {!isLoadingSession &&
        session.user &&
        activeCharacter &&
        !progress &&
        dbTemplateId && (
          <div className="callout">
            <h4>Import this guide</h4>
            <p>
              Importing creates a per-character checklist. You can toggle steps
              as you complete them.
            </p>
            <GuideImportButton
              characterId={activeCharacter.id}
              templateId={dbTemplateId}
            />
          </div>
        )}

      <GuideStepList
        key={guideKey}
        chapters={chapters}
        characterId={activeCharacter?.id ?? null}
        initialCompleted={progress?.completedSteps ?? []}
        isImported={Boolean(progress)}
        templateId={resolvedTemplateId}
        version={template.version}
      />
    </section>
  );
}
