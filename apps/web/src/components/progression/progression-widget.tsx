'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type ProgressionWidgetProps = {
  characterId: string | null;
  isAuthenticated: boolean;
  showLink?: boolean;
};

type ProgressionStats = {
  totalItems: number;
  completedItems: number;
  categoryBreakdown: Array<{
    name: string;
    icon: string | null;
    completed: number;
    total: number;
  }>;
};

type CategoryData = {
  id: string;
  name: string;
  icon: string | null;
  defaultItems: unknown[];
};

type ItemData = {
  id: string;
  categoryId: string | null;
  completed: boolean;
};

const GUEST_PROGRESSION_KEY = 'skillbound_guest_progression';

export function ProgressionWidget({
  characterId,
  isAuthenticated,
  showLink = true,
}: ProgressionWidgetProps) {
  const [stats, setStats] = useState<ProgressionStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        if (!isAuthenticated) {
          // Guest mode: calculate from localStorage and category templates
          const stored = localStorage.getItem(GUEST_PROGRESSION_KEY);
          const guestItems: Record<string, boolean> = stored
            ? (JSON.parse(stored) as Record<string, boolean>)
            : {};

          const categoriesRes = await fetch('/api/progression/categories');
          const categoriesData = (await categoriesRes.json()) as {
            data?: CategoryData[];
          };
          const categories: CategoryData[] = categoriesData.data ?? [];

          let totalItems = 0;
          let completedItems = 0;
          const categoryBreakdown: ProgressionStats['categoryBreakdown'] = [];

          for (const category of categories) {
            const defaultItems = category.defaultItems;
            const categoryTotal = defaultItems.length;
            let categoryCompleted = 0;

            for (let i = 0; i < categoryTotal; i++) {
              const itemKey = `${category.id}-${i}`;
              if (guestItems[itemKey]) {
                categoryCompleted++;
                completedItems++;
              }
            }

            totalItems += categoryTotal;
            categoryBreakdown.push({
              name: category.name,
              icon: category.icon,
              completed: categoryCompleted,
              total: categoryTotal,
            });
          }

          setStats({
            totalItems,
            completedItems,
            categoryBreakdown,
          });
          setLoading(false);
          return;
        }

        if (!characterId) {
          setLoading(false);
          return;
        }

        // Authenticated mode: fetch from API
        const [categoriesRes, itemsRes] = await Promise.all([
          fetch('/api/progression/categories'),
          fetch(`/api/progression/items?characterId=${characterId}`),
        ]);

        if (!categoriesRes.ok || !itemsRes.ok) {
          setLoading(false);
          return;
        }

        const categoriesData = (await categoriesRes.json()) as {
          data?: CategoryData[];
        };
        const itemsData = (await itemsRes.json()) as { data?: ItemData[] };

        const categories: CategoryData[] = categoriesData.data ?? [];
        const items: ItemData[] = itemsData.data ?? [];

        const totalItems = items.length;
        const completedItems = items.filter((item) => item.completed).length;

        const categoryBreakdown: ProgressionStats['categoryBreakdown'] = [];

        for (const category of categories) {
          const categoryItems = items.filter(
            (item) => item.categoryId === category.id
          );
          const categoryCompleted = categoryItems.filter(
            (item) => item.completed
          ).length;

          if (categoryItems.length > 0) {
            categoryBreakdown.push({
              name: category.name,
              icon: category.icon,
              completed: categoryCompleted,
              total: categoryItems.length,
            });
          }
        }

        setStats({
          totalItems,
          completedItems,
          categoryBreakdown,
        });
        setLoading(false);
      } catch (error) {
        console.error('Failed to load progression stats:', error);
        setLoading(false);
      }
    }

    void loadStats();
  }, [characterId, isAuthenticated]);

  if (loading) {
    return (
      <div className="stack-card">
        <h3>Progression</h3>
        <p>Loading...</p>
      </div>
    );
  }

  if (!stats || stats.totalItems === 0) {
    return (
      <div className="stack-card">
        <h3>Progression Tracker</h3>
        <p>
          {isAuthenticated && !characterId
            ? 'Select a character to track progression'
            : 'Track your ironman milestones and goals'}
        </p>
        {showLink && (
          <Link className="button ghost" href="/progression">
            View Progression
          </Link>
        )}
      </div>
    );
  }

  const completionPercent =
    stats.totalItems > 0
      ? Math.round((stats.completedItems / stats.totalItems) * 100)
      : 0;

  return (
    <div className="stack-card progression-widget">
      <h3>Progression Tracker</h3>

      <div className="progression-widget-summary">
        <div className="progression-widget-circle">
          <svg viewBox="0 0 100 100" className="progress-ring">
            <circle
              className="progress-ring-background"
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="rgba(212, 175, 55, 0.1)"
              strokeWidth="8"
            />
            <circle
              className="progress-ring-progress"
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="var(--accent-alt)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${completionPercent * 2.827} 282.7`}
              transform="rotate(-90 50 50)"
            />
          </svg>
          <div className="progress-ring-text">
            <span className="progress-percent">{completionPercent}%</span>
          </div>
        </div>

        <div className="progression-widget-stats">
          <div className="stat-item">
            <span className="stat-label">Completed</span>
            <span className="stat-value">
              {stats.completedItems} / {stats.totalItems}
            </span>
          </div>
        </div>
      </div>

      <div className="progression-widget-breakdown">
        {stats.categoryBreakdown.slice(0, 5).map((category) => {
          const categoryPercent =
            category.total > 0
              ? Math.round((category.completed / category.total) * 100)
              : 0;

          return (
            <div key={category.name} className="category-stat">
              <div className="category-stat-header">
                {category.icon && (
                  <span className="category-stat-icon">{category.icon}</span>
                )}
                <span className="category-stat-name">{category.name}</span>
                <span className="category-stat-count">
                  {category.completed}/{category.total}
                </span>
              </div>
              <div className="category-stat-bar">
                <div
                  className="category-stat-fill"
                  style={{ width: `${categoryPercent}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {showLink && (
        <Link className="button ghost" href="/progression">
          View All Items
        </Link>
      )}
    </div>
  );
}
