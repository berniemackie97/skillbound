'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type GuideSummary = {
  id: string;
  title: string;
  description: string | null;
  tags: string[];
  stepCount: number;
  recommendedModes: string[];
  version: number;
};

type GuidesClientProps = {
  guides: GuideSummary[];
  allTags: string[];
};

type GuideWithProgress = GuideSummary & {
  completedCount: number;
  isTracking: boolean;
  isCompleted: boolean;
};

type SessionPayload = {
  user: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
  characters: Array<{
    id: string;
    displayName: string;
    mode: string;
  }>;
  activeCharacterId: string | null;
};

type GuideProgressEntry = {
  guideTemplateId: string;
  guideVersion: number;
  completedSteps: number[];
  currentStep: number;
};

const GUIDES_PER_PAGE = 9;

export function GuidesClient({ guides, allTags }: GuidesClientProps) {
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [progressEntries, setProgressEntries] = useState<GuideProgressEntry[]>(
    []
  );
  const [search, setSearch] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [showTrackedOnly, setShowTrackedOnly] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      try {
        const response = await fetch('/api/nav/session', {
          cache: 'no-store',
        });
        if (!response.ok) {
          if (!cancelled) {
            setSession({ user: null, characters: [], activeCharacterId: null });
          }
          return;
        }
        const data = (await response.json()) as SessionPayload;
        if (!cancelled) {
          setSession(data);
        }
      } catch {
        if (!cancelled) {
          setSession({ user: null, characters: [], activeCharacterId: null });
        }
      }
    }

    void loadSession();

    return () => {
      cancelled = true;
    };
  }, []);

  const activeCharacterId = session?.activeCharacterId ?? null;
  const activeCharacter =
    session?.characters.find(
      (character) => character.id === activeCharacterId
    ) ?? null;
  const isLoggedIn = Boolean(session?.user);

  useEffect(() => {
    let cancelled = false;

    async function loadProgress(characterId: string) {
      try {
        const response = await fetch(
          `/api/guides/progress?characterId=${characterId}`,
          { cache: 'no-store' }
        );
        if (!response.ok) {
          if (!cancelled) {
            setProgressEntries([]);
          }
          return;
        }
        const payload = (await response.json()) as {
          data?: GuideProgressEntry[];
        };
        if (!cancelled) {
          setProgressEntries(Array.isArray(payload.data) ? payload.data : []);
        }
      } catch {
        if (!cancelled) {
          setProgressEntries([]);
        }
      }
    }

    if (activeCharacterId) {
      void loadProgress(activeCharacterId);
    } else {
      setProgressEntries([]);
    }

    return () => {
      cancelled = true;
    };
  }, [activeCharacterId]);

  const progressMap = useMemo(() => {
    const map = new Map<string, GuideProgressEntry[]>();
    for (const entry of progressEntries) {
      const existing = map.get(entry.guideTemplateId) ?? [];
      existing.push(entry);
      map.set(entry.guideTemplateId, existing);
    }
    return map;
  }, [progressEntries]);

  const guidesWithProgress = useMemo<GuideWithProgress[]>(() => {
    return guides.map((guide) => {
      const entries = progressMap.get(guide.id) ?? [];
      const match =
        entries.find((entry) => entry.guideVersion === guide.version) ??
        entries[0] ??
        null;
      const completedCount = match?.completedSteps?.length ?? 0;

      return {
        ...guide,
        completedCount,
        isTracking: Boolean(match),
        isCompleted: completedCount >= guide.stepCount && guide.stepCount > 0,
      };
    });
  }, [guides, progressMap]);

  // Filter guides based on search and tags
  const filteredGuides = useMemo(() => {
    return guidesWithProgress.filter((guide) => {
      const searchLower = search.toLowerCase();
      const matchesSearch =
        !search ||
        guide.title.toLowerCase().includes(searchLower) ||
        guide.description?.toLowerCase().includes(searchLower);

      const matchesTags =
        selectedTags.length === 0 ||
        selectedTags.some((tag) => guide.tags.includes(tag));

      const matchesTracked = !showTrackedOnly || guide.isTracking;

      return matchesSearch && matchesTags && matchesTracked;
    });
  }, [guidesWithProgress, search, selectedTags, showTrackedOnly]);

  // Pagination
  const totalPages = Math.ceil(filteredGuides.length / GUIDES_PER_PAGE);
  const paginatedGuides = filteredGuides.slice(
    (currentPage - 1) * GUIDES_PER_PAGE,
    currentPage * GUIDES_PER_PAGE
  );

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
  };

  const handleTagToggle = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
    setCurrentPage(1);
  };

  const handleTrackedToggle = () => {
    setShowTrackedOnly((prev) => !prev);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setSearch('');
    setSelectedTags([]);
    setShowTrackedOnly(false);
    setCurrentPage(1);
  };

  const hasActiveFilters = search || selectedTags.length > 0 || showTrackedOnly;

  return (
    <>
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
        ) : isLoggedIn ? (
          <Link className="guides-character-link" href="/characters">
            Select a character
          </Link>
        ) : null}
      </header>

      <div className="guides-panel">
        {/* Filters Bar */}
        <div className="guides-filters-bar">
          <div className="guides-search-box">
            <svg
              className="guides-search-icon"
              fill="none"
              height="18"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
              width="18"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              className="guides-search-input"
              placeholder="Search guides..."
              type="text"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </div>

          <div className="guides-filters-row">
            {allTags.length > 0 && (
              <div className="guides-tag-pills">
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    className={`guides-tag-pill ${selectedTags.includes(tag) ? 'active' : ''}`}
                    onClick={() => handleTagToggle(tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}

            <div className="guides-filters-actions">
              {isLoggedIn && activeCharacterId && (
                <button
                  className={`guides-filter-btn ${showTrackedOnly ? 'active' : ''}`}
                  onClick={handleTrackedToggle}
                >
                  <svg
                    fill="none"
                    height="14"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    width="14"
                  >
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                  Tracking
                </button>
              )}
              {hasActiveFilters && (
                <button className="guides-clear-btn" onClick={clearFilters}>
                  Clear filters
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Results Info */}
        <div className="guides-results-row">
          <span className="guides-count">
            {filteredGuides.length === guidesWithProgress.length
              ? `${guidesWithProgress.length} guide${guidesWithProgress.length !== 1 ? 's' : ''}`
              : `${filteredGuides.length} of ${guidesWithProgress.length} guides`}
          </span>
        </div>

        {/* Guide Grid */}
        {paginatedGuides.length > 0 ? (
          <div className="guides-grid">
            {paginatedGuides.map((guide) => (
              <GuideCard key={guide.id} guide={guide} />
            ))}
          </div>
        ) : (
          <div className="guides-empty-state">
            <p>No guides match your filters.</p>
            {hasActiveFilters && (
              <button className="button" onClick={clearFilters}>
                Clear filters
              </button>
            )}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="guides-pagination">
            <button
              className="guides-page-btn"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              <svg
                fill="none"
                height="16"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
                width="16"
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Prev
            </button>

            <div className="guides-page-numbers">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                (page) => (
                  <button
                    key={page}
                    className={`guides-page-num ${currentPage === page ? 'active' : ''}`}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </button>
                )
              )}
            </div>

            <button
              className="guides-page-btn"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
              <svg
                fill="none"
                height="16"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
                width="16"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </>
  );
}

function GuideCard({ guide }: { guide: GuideWithProgress }) {
  const progressPercent =
    guide.stepCount > 0
      ? Math.round((guide.completedCount / guide.stepCount) * 100)
      : 0;

  return (
    <Link className="guide-card" href={`/guides/${guide.id}`}>
      <div className="guide-card-body">
        <div className="guide-card-top">
          <h3 className="guide-card-title">{guide.title}</h3>
          {guide.isCompleted && (
            <span className="guide-card-status completed" title="Completed">
              <svg
                fill="none"
                height="14"
                stroke="currentColor"
                strokeWidth="3"
                viewBox="0 0 24 24"
                width="14"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </span>
          )}
          {guide.isTracking && !guide.isCompleted && (
            <span className="guide-card-status tracking" title="In Progress">
              <svg
                fill="none"
                height="14"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
                width="14"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </span>
          )}
        </div>

        {guide.description && (
          <p className="guide-card-desc">{guide.description}</p>
        )}

        <div className="guide-card-info">
          <span className="guide-card-steps">
            {guide.stepCount} {guide.stepCount === 1 ? 'step' : 'steps'}
          </span>
          {guide.tags.length > 0 && (
            <div className="guide-card-tags">
              {guide.tags.slice(0, 2).map((tag) => (
                <span key={tag} className="guide-card-tag">
                  {tag}
                </span>
              ))}
              {guide.tags.length > 2 && (
                <span className="guide-card-tag-overflow">
                  +{guide.tags.length - 2}
                </span>
              )}
            </div>
          )}
        </div>

        {guide.recommendedModes.length > 0 && (
          <div className="guide-card-modes">
            {guide.recommendedModes.map((mode) => (
              <span key={mode} className="guide-card-mode">
                {mode}
              </span>
            ))}
          </div>
        )}
      </div>

      {guide.isTracking && (
        <div className="guide-card-progress">
          <div className="guide-card-progress-track">
            <div
              className="guide-card-progress-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="guide-card-progress-label">
            {guide.completedCount}/{guide.stepCount}
          </span>
        </div>
      )}
    </Link>
  );
}
