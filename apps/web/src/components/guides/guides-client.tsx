'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';

type GuideWithProgress = {
  id: string;
  title: string;
  description: string | null;
  tags: string[];
  stepCount: number;
  completedCount: number;
  recommendedModes: string[];
  isTracking: boolean;
  isCompleted: boolean;
};

type GuidesClientProps = {
  guides: GuideWithProgress[];
  allTags: string[];
  isLoggedIn: boolean;
  activeCharacterId: string | null;
};

const GUIDES_PER_PAGE = 9;

export function GuidesClient({
  guides,
  allTags,
  isLoggedIn,
  activeCharacterId,
}: GuidesClientProps) {
  const [search, setSearch] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [showTrackedOnly, setShowTrackedOnly] = useState(false);

  // Filter guides based on search and tags
  const filteredGuides = useMemo(() => {
    return guides.filter((guide) => {
      // Search filter
      const searchLower = search.toLowerCase();
      const matchesSearch =
        !search ||
        guide.title.toLowerCase().includes(searchLower) ||
        guide.description?.toLowerCase().includes(searchLower);

      // Tag filter
      const matchesTags =
        selectedTags.length === 0 ||
        selectedTags.some((tag) => guide.tags.includes(tag));

      // Tracked filter
      const matchesTracked = !showTrackedOnly || guide.isTracking;

      return matchesSearch && matchesTags && matchesTracked;
    });
  }, [guides, search, selectedTags, showTrackedOnly]);

  // Pagination
  const totalPages = Math.ceil(filteredGuides.length / GUIDES_PER_PAGE);
  const paginatedGuides = filteredGuides.slice(
    (currentPage - 1) * GUIDES_PER_PAGE,
    currentPage * GUIDES_PER_PAGE
  );

  // Reset to page 1 when filters change
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
    <div className="guides-content">
      {/* Filters */}
      <div className="guides-filters">
        <div className="guides-search">
          <svg
            className="guides-search-icon"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search guides..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="guides-search-input"
          />
        </div>

        {allTags.length > 0 && (
          <div className="guides-tag-filters">
            {allTags.map((tag) => (
              <button
                key={tag}
                className={`guides-tag-filter ${selectedTags.includes(tag) ? 'active' : ''}`}
                onClick={() => handleTagToggle(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        <div className="guides-filter-actions">
          {isLoggedIn && activeCharacterId && (
            <button
              className={`guides-tracked-filter ${showTrackedOnly ? 'active' : ''}`}
              onClick={handleTrackedToggle}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              Tracking
            </button>
          )}
          {hasActiveFilters && (
            <button className="guides-clear-filters" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Results count */}
      <div className="guides-results-info">
        <span>
          {filteredGuides.length === guides.length
            ? `${guides.length} guides`
            : `${filteredGuides.length} of ${guides.length} guides`}
        </span>
      </div>

      {/* Guide grid */}
      {paginatedGuides.length > 0 ? (
        <div className="guides-grid">
          {paginatedGuides.map((guide) => (
            <GuideCard
              key={guide.id}
              guide={guide}
              isLoggedIn={isLoggedIn}
              hasActiveCharacter={Boolean(activeCharacterId)}
            />
          ))}
        </div>
      ) : (
        <div className="guides-empty">
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
            className="guides-pagination-btn"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Previous
          </button>

          <div className="guides-pagination-pages">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                className={`guides-pagination-page ${currentPage === page ? 'active' : ''}`}
                onClick={() => setCurrentPage(page)}
              >
                {page}
              </button>
            ))}
          </div>

          <button
            className="guides-pagination-btn"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            Next
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

function GuideCard({
  guide,
  isLoggedIn,
  hasActiveCharacter,
}: {
  guide: GuideWithProgress;
  isLoggedIn: boolean;
  hasActiveCharacter: boolean;
}) {
  const progressPercent =
    guide.stepCount > 0
      ? Math.round((guide.completedCount / guide.stepCount) * 100)
      : 0;

  return (
    <Link href={`/guides/${guide.id}`} className="guide-card">
      <div className="guide-card-header">
        <h3 className="guide-card-title">{guide.title}</h3>
        {guide.isCompleted && (
          <span className="guide-card-badge completed">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
        )}
        {guide.isTracking && !guide.isCompleted && (
          <span className="guide-card-badge tracking">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </span>
        )}
      </div>

      {guide.description && (
        <p className="guide-card-description">{guide.description}</p>
      )}

      <div className="guide-card-meta">
        <span className="guide-card-steps">
          {guide.stepCount} {guide.stepCount === 1 ? 'step' : 'steps'}
        </span>
        {guide.tags.length > 0 && (
          <div className="guide-card-tags">
            {guide.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="guide-card-tag">
                {tag}
              </span>
            ))}
            {guide.tags.length > 3 && (
              <span className="guide-card-tag-more">+{guide.tags.length - 3}</span>
            )}
          </div>
        )}
      </div>

      {guide.isTracking && (
        <div className="guide-card-progress">
          <div className="guide-card-progress-bar">
            <div
              className="guide-card-progress-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="guide-card-progress-text">
            {guide.completedCount}/{guide.stepCount}
          </span>
        </div>
      )}

      {guide.recommendedModes.length > 0 && (
        <div className="guide-card-modes">
          {guide.recommendedModes.map((mode) => (
            <span key={mode} className="guide-card-mode">
              {mode}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}
