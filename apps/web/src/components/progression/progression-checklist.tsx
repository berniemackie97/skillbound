'use client';

import { useEffect, useState } from 'react';

type ProgressionItem = {
  id: string;
  characterId: string;
  categoryId: string | null;
  itemType: 'unlock' | 'item' | 'gear' | 'goal' | 'custom';
  name: string;
  description: string | null;
  itemId: number | null;
  unlockFlag: string | null;
  completed: boolean;
  completedAt: string | null;
  notes: string | null;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
};

type GuestItem = {
  id: string;
  name: string;
  description: string | null;
  itemType: ProgressionItem['itemType'];
  completed: boolean;
};

type DisplayItem = ProgressionItem | GuestItem;

type ProgressionCategory = {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  orderIndex: number;
  defaultItems: unknown[];
};

type ProgressionChecklistProps = {
  characterId: string | null;
  isAuthenticated: boolean;
};

// LocalStorage key for guest mode
const GUEST_PROGRESSION_KEY = 'skillbound_guest_progression';

export function ProgressionChecklist({
  characterId,
  isAuthenticated,
}: ProgressionChecklistProps) {
  const [categories, setCategories] = useState<ProgressionCategory[]>([]);
  const [items, setItems] = useState<ProgressionItem[]>([]);
  const [guestItems, setGuestItems] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<
    Record<string, boolean>
  >({});
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');

  // Load guest data from localStorage
  useEffect(() => {
    if (!isAuthenticated) {
      const stored = localStorage.getItem(GUEST_PROGRESSION_KEY);
      if (stored) {
        try {
          setGuestItems(JSON.parse(stored) as Record<string, boolean>);
        } catch {
          setGuestItems({});
        }
      }
    }
  }, [isAuthenticated]);

  // Save guest data to localStorage
  useEffect(() => {
    if (!isAuthenticated && Object.keys(guestItems).length > 0) {
      localStorage.setItem(GUEST_PROGRESSION_KEY, JSON.stringify(guestItems));
    }
  }, [guestItems, isAuthenticated]);

  // Fetch categories
  useEffect(() => {
    async function loadCategories() {
      try {
        const response = await fetch('/api/progression/categories');
        if (!response.ok) throw new Error('Failed to load categories');
        const data = (await response.json()) as {
          data?: ProgressionCategory[];
        };
        const cats = data.data ?? [];
        setCategories(cats);

        // Expand all categories by default
        const expanded: Record<string, boolean> = {};
        for (const cat of cats) {
          expanded[cat.id] = true;
        }
        setExpandedCategories(expanded);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    }

    void loadCategories();
  }, []);

  // Fetch items for authenticated users and auto-initialize if empty
  useEffect(() => {
    if (!isAuthenticated || !characterId) {
      setLoading(false);
      return;
    }

    async function loadItems() {
      try {
        const response = await fetch(
          `/api/progression/items?characterId=${characterId}`
        );
        if (!response.ok) throw new Error('Failed to load progression items');
        const data = (await response.json()) as { data?: ProgressionItem[] };

        // If no items exist, auto-initialize
        if (!data.data || data.data.length === 0) {
          await autoInitialize();
        } else {
          setItems(data.data);
          setLoading(false);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setLoading(false);
      }
    }

    async function autoInitialize() {
      try {
        const response = await fetch('/api/progression/items/initialize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ characterId }),
        });

        if (!response.ok) throw new Error('Failed to initialize items');

        const data = (await response.json()) as {
          data?: { items?: ProgressionItem[] };
        };
        setItems(data.data?.items ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    void loadItems();
  }, [isAuthenticated, characterId]);

  // Toggle item completion
  async function handleToggleItem(itemId: string, currentState: boolean) {
    if (!isAuthenticated) {
      // Guest mode: toggle in local state
      setGuestItems((prev) => ({
        ...prev,
        [itemId]: !currentState,
      }));
      return;
    }

    // Authenticated: update via API
    const optimisticUpdate = items.map((item) =>
      item.id === itemId ? { ...item, completed: !currentState } : item
    );
    setItems(optimisticUpdate);

    try {
      const response = await fetch(`/api/progression/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !currentState }),
      });

      if (!response.ok) throw new Error('Failed to update item');

      const data = (await response.json()) as { data?: ProgressionItem };
      if (data.data) {
        const updatedItem = data.data;
        setItems((prev) =>
          prev.map((item) => (item.id === itemId ? updatedItem : item))
        );
      }
    } catch (err) {
      // Revert on error
      setItems(items);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }

  // Toggle category expansion
  function toggleCategory(categoryId: string) {
    setExpandedCategories((prev) => ({
      ...prev,
      [categoryId]: !prev[categoryId],
    }));
  }

  // Get items for a category
  function getCategoryItems(categoryId: string): DisplayItem[] {
    if (isAuthenticated && characterId) {
      return items.filter((item) => item.categoryId === categoryId);
    }

    // Guest mode: use templates from category
    const category = categories.find((c) => c.id === categoryId);
    if (!category) return [];

    return (
      category.defaultItems as Array<{
        name: string;
        description?: string;
        itemType: string;
      }>
    ).map((template, idx) => ({
      id: `${categoryId}-${idx}`,
      name: template.name,
      description: template.description ?? null,
      itemType: template.itemType as ProgressionItem['itemType'],
      completed: guestItems[`${categoryId}-${idx}`] ?? false,
    }));
  }

  // Filter items
  function filterItems(categoryItems: DisplayItem[]): DisplayItem[] {
    if (filter === 'pending') {
      return categoryItems.filter((item) => !item.completed);
    }
    if (filter === 'completed') {
      return categoryItems.filter((item) => item.completed);
    }
    return categoryItems;
  }

  if (loading) {
    return (
      <div className="progression-loading">
        <p>Loading progression data...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="progression-container">
        <div className="progression-header">
          <div>
            <h2>Progression Tracker</h2>
            <p className="text-muted">
              Guest Mode - Progress saved locally only. Sign in to sync across
              devices.
            </p>
          </div>
          <div className="progression-filters">
            <select
              value={filter}
              onChange={(e) =>
                setFilter(e.target.value as 'all' | 'pending' | 'completed')
              }
              className="filter-select"
            >
              <option value="all">All Items</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>

        {error && <div className="progression-error">{error}</div>}

        <div className="progression-categories">
          {categories.map((category) => {
            const categoryItems = filterItems(getCategoryItems(category.id));
            const completedCount = getCategoryItems(category.id).filter(
              (item) => item.completed
            ).length;
            const totalCount = getCategoryItems(category.id).length;

            return (
              <div key={category.id} className="category-section">
                <button
                  className="category-header"
                  onClick={() => toggleCategory(category.id)}
                >
                  <div className="category-title">
                    {category.icon && (
                      <span className="category-icon">{category.icon}</span>
                    )}
                    <div>
                      <h3>{category.name}</h3>
                      {category.description && (
                        <p className="category-description">
                          {category.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="category-meta">
                    <span className="category-progress">
                      {completedCount}/{totalCount}
                    </span>
                    <span className="category-toggle">
                      {expandedCategories[category.id] ? '▼' : '▶'}
                    </span>
                  </div>
                </button>

                {expandedCategories[category.id] && (
                  <div className="category-items">
                    {categoryItems.length === 0 ? (
                      <p className="no-items">No items match filter</p>
                    ) : (
                      categoryItems.map((item) => (
                        <div
                          key={item.id}
                          className={`progression-item ${item.completed ? 'completed' : ''}`}
                        >
                          <label className="item-checkbox">
                            <input
                              type="checkbox"
                              checked={item.completed}
                              onChange={() =>
                                void handleToggleItem(item.id, item.completed)
                              }
                            />
                            <div className="item-content">
                              <div className="item-name">{item.name}</div>
                              {item.description && (
                                <div className="item-description">
                                  {item.description}
                                </div>
                              )}
                            </div>
                          </label>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Authenticated mode
  if (!characterId) {
    return (
      <div className="progression-empty">
        <h3>No Active Character</h3>
        <p>Select or create a character to track progression.</p>
      </div>
    );
  }

  return (
    <div className="progression-container">
      <div className="progression-header">
        <div>
          <h2>Progression Tracker</h2>
          <p className="text-muted">
            Track your ironman journey milestones and goals
          </p>
        </div>
        <div className="progression-filters">
          <select
            value={filter}
            onChange={(e) =>
              setFilter(e.target.value as 'all' | 'pending' | 'completed')
            }
            className="filter-select"
          >
            <option value="all">All Items</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      {error && <div className="progression-error">{error}</div>}

      <div className="progression-categories">
        {categories.map((category) => {
          const categoryItems = filterItems(getCategoryItems(category.id));
          const completedCount = getCategoryItems(category.id).filter(
            (item) => item.completed
          ).length;
          const totalCount = getCategoryItems(category.id).length;

          return (
            <div key={category.id} className="category-section">
              <button
                className="category-header"
                onClick={() => toggleCategory(category.id)}
              >
                <div className="category-title">
                  {category.icon && (
                    <span className="category-icon">{category.icon}</span>
                  )}
                  <div>
                    <h3>{category.name}</h3>
                    {category.description && (
                      <p className="category-description">
                        {category.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="category-meta">
                  <span className="category-progress">
                    {completedCount}/{totalCount}
                  </span>
                  <span className="category-toggle">
                    {expandedCategories[category.id] ? '▼' : '▶'}
                  </span>
                </div>
              </button>

              {expandedCategories[category.id] && (
                <div className="category-items">
                  {categoryItems.length === 0 ? (
                    <p className="no-items">No items match filter</p>
                  ) : (
                    categoryItems.map((item) => (
                      <div
                        key={item.id}
                        className={`progression-item ${item.completed ? 'completed' : ''}`}
                      >
                        <label className="item-checkbox">
                          <input
                            type="checkbox"
                            checked={item.completed}
                            onChange={() =>
                              void handleToggleItem(item.id, item.completed)
                            }
                          />
                          <div className="item-content">
                            <div className="item-name">{item.name}</div>
                            {item.description && (
                              <div className="item-description">
                                {item.description}
                              </div>
                            )}
                          </div>
                        </label>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
