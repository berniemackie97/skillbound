'use client';

import type { GuideInstruction, GuideStepMeta } from '@skillbound/database';
import type { RequirementResult, RequirementStatus } from '@skillbound/domain';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  RequirementList,
  RequirementNamesProvider,
} from '../requirements/requirements-ui';

export type GuideStepView = {
  stepNumber: number;
  title: string;
  instructions?: GuideInstruction[];
  status: RequirementStatus;
  required: RequirementResult[];
  optional: RequirementResult[];
  meta?: GuideStepMeta;
};

export type GuideSectionView = {
  id: string;
  title: string;
  description: string;
  chapterTitle: string;
  steps: GuideStepView[];
};

export type GuideChapterView = {
  title: string;
  sections: GuideSectionView[];
};

type GuideStepListProps = {
  chapters: GuideChapterView[];
  characterId: string | null;
  templateId: string;
  version: number;
  initialCompleted: number[];
  isImported: boolean;
};

/**
 * Tracks which items/instructions are marked as "ready" within a step.
 * Key format: `${stepNumber}-item-${index}` or `${stepNumber}-instruction-${index}`
 */
type ReadyItems = Set<string>;

function getNextStepNumber(steps: GuideStepView[], completed: Set<number>) {
  for (const step of steps) {
    if (!completed.has(step.stepNumber)) {
      return step.stepNumber;
    }
  }
  return 0;
}

function formatGpStack(gp?: { note?: string; min?: number; max?: number }) {
  // Always show a number, defaulting to 0 gp.
  const min = gp?.min ?? 0;
  const max = gp?.max;

  if (max !== undefined && max !== min) {
    return `${min.toLocaleString()}–${max.toLocaleString()} gp`;
  }

  return `${min.toLocaleString()} gp`;
}

function collectGuideRequirementGroups(
  steps: GuideStepView[]
): RequirementResult[][] {
  const groups: RequirementResult[][] = [];
  for (const step of steps) {
    if (step.required.length > 0) {
      groups.push(step.required);
    }
    if (step.optional.length > 0) {
      groups.push(step.optional);
    }
  }
  return groups;
}

export function GuideStepList({
  chapters,
  characterId,
  templateId,
  version,
  initialCompleted,
  isImported,
}: GuideStepListProps) {
  const router = useRouter();
  const localStorageKey = `guide-progress-${templateId}-${characterId || 'guest'}`;

  const [completed, setCompleted] = useState<Set<number>>(() => {
    // If imported with character, use server data
    if (isImported && initialCompleted.length > 0) {
      return new Set(initialCompleted);
    }

    // Otherwise, try to load from localStorage
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(localStorageKey);
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as unknown;
          if (
            Array.isArray(parsed) &&
            parsed.every((item) => typeof item === 'number')
          ) {
            return new Set(parsed);
          }
          return new Set();
        } catch {
          return new Set();
        }
      }
    }

    return new Set(initialCompleted);
  });

  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(
    () => new Set(chapters.map((ch) => ch.title))
  );
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    () => new Set()
  );

  // Track items and instructions marked as "ready" (highlighted green)
  const readyStorageKey = `guide-ready-${templateId}-${characterId || 'guest'}`;
  const [readyItems, setReadyItems] = useState<ReadyItems>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(readyStorageKey);
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as unknown;
          if (
            Array.isArray(parsed) &&
            parsed.every((item) => typeof item === 'string')
          ) {
            return new Set(parsed);
          }
        } catch {
          // ignore parse errors
        }
      }
    }
    return new Set();
  });

  // Persist ready items to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(
        readyStorageKey,
        JSON.stringify(Array.from(readyItems))
      );
    }
  }, [readyItems, readyStorageKey]);

  const toggleReadyItem = useCallback((key: string) => {
    setReadyItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const flatSteps = useMemo(() => {
    const aggregated: GuideStepView[] = [];
    for (const chapter of chapters) {
      for (const section of chapter.sections) {
        aggregated.push(...section.steps);
      }
    }
    return aggregated;
  }, [chapters]);

  const completedList = useMemo(
    () => Array.from(completed).sort((a, b) => a - b),
    [completed]
  );

  const progressPercent = useMemo(() => {
    if (flatSteps.length === 0) return 0;
    return Math.round((completedList.length / flatSteps.length) * 100);
  }, [completedList.length, flatSteps.length]);

  const filteredChapters = useMemo(() => {
    if (!searchQuery) return chapters;

    const query = searchQuery.toLowerCase();
    return chapters
      .map((chapter) => ({
        ...chapter,
        sections: chapter.sections
          .map((section) => ({
            ...section,
            steps: section.steps.filter(
              (step) =>
                step.title.toLowerCase().includes(query) ||
                section.title.toLowerCase().includes(query) ||
                step.instructions?.some((inst) =>
                  inst.text.toLowerCase().includes(query)
                )
            ),
          }))
          .filter((section) => section.steps.length > 0),
      }))
      .filter((chapter) => chapter.sections.length > 0);
  }, [chapters, searchQuery]);

  // Auto-clear status message after 3 seconds
  useEffect(() => {
    if (!status) return;

    const timer = setTimeout(() => {
      setStatus(null);
    }, 3000);

    return () => clearTimeout(timer);
  }, [status]);

  function toggleChapter(chapterTitle: string) {
    const next = new Set(expandedChapters);
    if (next.has(chapterTitle)) {
      next.delete(chapterTitle);
    } else {
      next.add(chapterTitle);
    }
    setExpandedChapters(next);
  }

  function toggleSection(sectionId: string) {
    const next = new Set(expandedSections);
    if (next.has(sectionId)) {
      next.delete(sectionId);
    } else {
      next.add(sectionId);
    }
    setExpandedSections(next);
  }

  async function updateProgress(nextCompleted: Set<number>) {
    // Save to localStorage for all users
    if (typeof window !== 'undefined') {
      localStorage.setItem(
        localStorageKey,
        JSON.stringify(Array.from(nextCompleted))
      );
    }

    // If user has imported to character, also save to server
    if (characterId && isImported) {
      setError(null);
      setStatus('Saving progress…');

      const response = await fetch('/api/guides/progress', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterId,
          templateId,
          version,
          completedSteps: Array.from(nextCompleted),
          currentStep: getNextStepNumber(flatSteps, nextCompleted),
        }),
      });

      if (!response.ok) {
        setStatus(null);
        setError('Unable to save progress to server.');
        return false;
      }

      setStatus('Progress saved to character.');
      router.refresh();
    } else {
      setStatus('Progress saved locally.');
    }

    return true;
  }

  async function toggleStep(stepNumber: number) {
    const nextCompleted = new Set(completed);
    if (nextCompleted.has(stepNumber)) {
      nextCompleted.delete(stepNumber);
    } else {
      nextCompleted.add(stepNumber);
    }
    setCompleted(nextCompleted);
    const success = await updateProgress(nextCompleted);
    if (!success) {
      setCompleted(completed);
    }
  }

  return (
    <div className="guide-steps">
      <div className="guide-steps-header">
        <div className="guide-progress-bar">
          <div className="progress-bar-track">
            <div
              className="progress-bar-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="progress-text">
            {completedList.length} of {flatSteps.length} completed (
            {progressPercent}%)
          </span>
        </div>

        <div className="guide-search">
          <input
            className="search-input"
            placeholder="Search steps..."
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="guide-steps-meta">
          {status && !error && <span className="status-note">{status}</span>}
          {error && <span className="error">{error}</span>}
        </div>
      </div>

      <div className="guide-chapters">
        {filteredChapters.map((chapter) => {
          const isChapterExpanded = expandedChapters.has(chapter.title);

          return (
            <div key={chapter.title || 'Guide'} className="guide-chapter">
              {chapter.title && (
                <h3 className="chapter-title">
                  <button
                    aria-expanded={isChapterExpanded}
                    className="chapter-title-toggle"
                    type="button"
                    onClick={() => toggleChapter(chapter.title)}
                  >
                    <span className="toggle-icon">
                      {isChapterExpanded ? '▼' : '▶'}
                    </span>
                    {chapter.title}
                  </button>
                </h3>
              )}
              {isChapterExpanded &&
                chapter.sections.map((section) => {
                  const isSectionExpanded = expandedSections.has(section.id);

                  return (
                    <div key={section.id} className="guide-section">
                      <button
                        aria-expanded={isSectionExpanded}
                        className="guide-section-header"
                        type="button"
                        onClick={() => toggleSection(section.id)}
                      >
                        <h4>
                          <span className="toggle-icon">
                            {isSectionExpanded ? '▼' : '▶'}
                          </span>
                          {section.title}
                        </h4>
                        {section.description && (
                          <p className="guide-section-description">
                            {section.description}
                          </p>
                        )}
                      </button>
                      {isSectionExpanded && (
                        <RequirementNamesProvider
                          items={collectGuideRequirementGroups(section.steps)}
                        >
                          <ol className="guide-step-list">
                            {section.steps.map((step) => {
                              const isChecked = completed.has(step.stepNumber);
                              const hasRequirements =
                                step.required.length > 0 ||
                                step.optional.length > 0;

                              return (
                                <li
                                  key={step.stepNumber}
                                  className={`guide-step ${isChecked ? 'completed' : ''}`}
                                >
                                  <div className="guide-step-header">
                                    <input
                                      checked={isChecked}
                                      type="checkbox"
                                      onChange={() =>
                                        toggleStep(step.stepNumber)
                                      }
                                    />
                                    <span className="guide-step-number">
                                      Step {step.stepNumber}
                                    </span>
                                  </div>
                                  {step.instructions &&
                                    step.instructions.length > 0 && (
                                      <div className="guide-step-content">
                                        {/* Render instructions as a clickable list */}
                                        <ol className="guide-instructions-list">
                                          {step.instructions.map(
                                            (instruction, idx) => {
                                              const instructionKey = `${step.stepNumber}-instruction-${idx}`;
                                              const isReady =
                                                readyItems.has(instructionKey);
                                              const imageLink =
                                                instruction.imageLink;
                                              const imageUrl =
                                                instruction.imageUrl;
                                              const hasImage =
                                                Boolean(imageUrl);
                                              const imageAlt =
                                                instruction.imageAlt ??
                                                `Instruction ${idx + 1} reference image`;

                                              return (
                                                <li
                                                  key={idx}
                                                  className={`guide-instruction-item ${isReady ? 'ready' : ''}`}
                                                >
                                                  <div className="instruction-content">
                                                    <button
                                                      aria-pressed={isReady}
                                                      className="instruction-toggle"
                                                      type="button"
                                                      onClick={() =>
                                                        toggleReadyItem(
                                                          instructionKey
                                                        )
                                                      }
                                                    >
                                                      <div className="instruction-body">
                                                        <span className="instruction-text">
                                                          {instruction.text}
                                                        </span>
                                                        {instruction.note && (
                                                          <span className="instruction-note">
                                                            {instruction.note}
                                                          </span>
                                                        )}
                                                      </div>
                                                    </button>
                                                    {hasImage && imageUrl && (
                                                      <div className="instruction-media">
                                                        {instruction.imageLink ? (
                                                          <a
                                                            className="instruction-media-link"
                                                            href={imageLink}
                                                            rel="noreferrer"
                                                            target="_blank"
                                                          >
                                                            <div className="instruction-image">
                                                              <Image
                                                                alt={imageAlt}
                                                                className="instruction-img"
                                                                height={320}
                                                                src={imageUrl}
                                                                width={320}
                                                              />
                                                            </div>
                                                            <span className="instruction-media-label">
                                                              View on wiki
                                                            </span>
                                                          </a>
                                                        ) : (
                                                          <div className="instruction-image">
                                                            <Image
                                                              alt={imageAlt}
                                                              className="instruction-img"
                                                              height={320}
                                                              src={imageUrl}
                                                              width={320}
                                                            />
                                                          </div>
                                                        )}
                                                      </div>
                                                    )}
                                                  </div>
                                                </li>
                                              );
                                            }
                                          )}
                                        </ol>
                                        <div className="guide-step-meta">
                                          {/* 1) GP Stack */}
                                          <div className="meta-item">
                                            <strong>GP Stack:</strong>
                                            <span>
                                              {step.meta?.gpStack?.note
                                                ? `${formatGpStack(step.meta.gpStack)} — ${step.meta.gpStack.note}`
                                                : formatGpStack(
                                                    step.meta?.gpStack
                                                  )}
                                            </span>
                                          </div>

                                          {/* 2) Items Needed - clickable to mark as ready */}
                                          <div className="meta-item">
                                            <strong>Items Needed:</strong>
                                            {step.meta &&
                                            step.meta.itemsNeeded.length > 0 ? (
                                              <ul className="meta-items-list">
                                                {step.meta.itemsNeeded.map(
                                                  (item, idx) => {
                                                    const itemKey = `${step.stepNumber}-item-${idx}`;
                                                    const isItemReady =
                                                      readyItems.has(itemKey);
                                                    const toggleItemReady = () =>
                                                      toggleReadyItem(itemKey);

                                                    return (
                                                      <li
                                                        key={idx}
                                                        className={
                                                          isItemReady
                                                            ? 'ready'
                                                            : ''
                                                        }
                                                      >
                                                        <button
                                                          aria-pressed={isItemReady}
                                                          className="meta-item-toggle"
                                                          type="button"
                                                          onClick={toggleItemReady}
                                                        >
                                                          {item.icon && (
                                                            <span className="item-icon">
                                                              {item.icon}
                                                            </span>
                                                          )}
                                                          <span className="item-qty">
                                                            {item.qty}×
                                                          </span>{' '}
                                                          <span className="item-name">
                                                            {item.name}
                                                          </span>
                                                          {item.note && (
                                                            <span className="item-note">
                                                              ({item.note})
                                                            </span>
                                                          )}
                                                        </button>
                                                      </li>
                                                    );
                                                  }
                                                )}
                                              </ul>
                                            ) : (
                                              <span>N/A</span>
                                            )}
                                          </div>

                                          {/* 3) Stats - Required and After */}
                                          <div className="meta-item">
                                            <strong>Stats:</strong>
                                            {step.meta?.stats &&
                                            (step.meta.stats.required.length >
                                              0 ||
                                              step.meta.stats.after.length >
                                                0) ? (
                                              <div className="meta-stats-sections">
                                                {step.meta.stats.required
                                                  .length > 0 && (
                                                  <div className="stats-subsection">
                                                    <span className="stats-label required">
                                                      Need
                                                    </span>
                                                    <ul className="meta-stats-list">
                                                      {step.meta.stats.required.map(
                                                        (stat, idx) => {
                                                          const statKey = `${step.stepNumber}-stat-req-${idx}`;
                                                          const isStatReady =
                                                            readyItems.has(
                                                              statKey
                                                            );
                                                          const toggleStatReady =
                                                            () =>
                                                              toggleReadyItem(
                                                                statKey
                                                              );

                                                          return (
                                                            <li
                                                              key={idx}
                                                              className={
                                                                isStatReady
                                                                  ? 'ready'
                                                                  : ''
                                                              }
                                                            >
                                                              <button
                                                                aria-pressed={isStatReady}
                                                                className="meta-item-toggle"
                                                                type="button"
                                                                onClick={toggleStatReady}
                                                              >
                                                                <span className="stat-level">
                                                                  {stat.level}
                                                                </span>
                                                                <span className="stat-skill">
                                                                  {stat.skill}
                                                                </span>
                                                                {stat.note && (
                                                                  <span className="stat-note">
                                                                    ({stat.note}
                                                                    )
                                                                  </span>
                                                                )}
                                                              </button>
                                                            </li>
                                                          );
                                                        }
                                                      )}
                                                    </ul>
                                                  </div>
                                                )}
                                                {step.meta.stats.after.length >
                                                  0 && (
                                                  <div className="stats-subsection">
                                                    <span className="stats-label after">
                                                      After
                                                    </span>
                                                    <ul className="meta-stats-list">
                                                      {step.meta.stats.after.map(
                                                        (stat, idx) => {
                                                          const statKey = `${step.stepNumber}-stat-after-${idx}`;
                                                          const isStatReady =
                                                            readyItems.has(
                                                              statKey
                                                            );
                                                          const toggleStatReady =
                                                            () =>
                                                              toggleReadyItem(
                                                                statKey
                                                              );

                                                          return (
                                                            <li
                                                              key={idx}
                                                              className={
                                                                isStatReady
                                                                  ? 'ready'
                                                                  : ''
                                                              }
                                                            >
                                                              <button
                                                                aria-pressed={isStatReady}
                                                                className="meta-item-toggle"
                                                                type="button"
                                                                onClick={toggleStatReady}
                                                              >
                                                                <span className="stat-level">
                                                                  {stat.level}
                                                                </span>
                                                                <span className="stat-skill">
                                                                  {stat.skill}
                                                                </span>
                                                                {stat.note && (
                                                                  <span className="stat-note">
                                                                    ({stat.note}
                                                                    )
                                                                  </span>
                                                                )}
                                                              </button>
                                                            </li>
                                                          );
                                                        }
                                                      )}
                                                    </ul>
                                                  </div>
                                                )}
                                              </div>
                                            ) : (
                                              <span>N/A</span>
                                            )}
                                          </div>

                                          {/* 4) Alternative Routes */}
                                          <div className="meta-item">
                                            <strong>Alternative routes:</strong>
                                            {step.meta &&
                                            step.meta.alternativeRoutes.length >
                                              0 ? (
                                              <ul className="meta-alternatives-list">
                                                {step.meta.alternativeRoutes.map(
                                                  (alt, idx) => (
                                                    <li key={idx}>
                                                      {alt.title && (
                                                        <strong>
                                                          {alt.title}:
                                                        </strong>
                                                      )}{' '}
                                                      {alt.text}
                                                    </li>
                                                  )
                                                )}
                                              </ul>
                                            ) : (
                                              <span>N/A</span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  {hasRequirements && (
                                    <div className="guide-step-requirements">
                                      <RequirementList items={step.required} />
                                      {step.optional.length > 0 && (
                                        <>
                                          <div className="muted">
                                            Optional requirements
                                          </div>
                                          <RequirementList
                                            items={step.optional}
                                          />
                                        </>
                                      )}
                                    </div>
                                  )}
                                </li>
                              );
                            })}
                          </ol>
                        </RequirementNamesProvider>
                      )}
                    </div>
                  );
                })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
