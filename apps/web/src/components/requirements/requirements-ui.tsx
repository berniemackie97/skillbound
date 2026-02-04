'use client';

import type {
  Requirement,
  RequirementResult,
  RequirementStatus,
} from '@skillbound/domain';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

function titleize(value: string) {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function statusClass(status: RequirementStatus) {
  return `status-pill ${status.toLowerCase().replace('_', '-')}`;
}

type ItemNameMap = Record<number, string>;

const ItemNameContext = createContext<ItemNameMap | null>(null);

const UNTRACKED_TYPES = new Set<Requirement['type']>([
  'item-possessed',
  'manual-check',
]);

function isUntrackedRequirement(requirement: Requirement): boolean {
  return UNTRACKED_TYPES.has(requirement.type);
}

function resultIsUntracked(result: RequirementResult): boolean {
  if (isUntrackedRequirement(result.requirement)) {
    return true;
  }

  if (
    (result.requirement.type === 'all-of' ||
      result.requirement.type === 'any-of') &&
    result.children &&
    result.children.length > 0
  ) {
    return result.children.every(resultIsUntracked);
  }

  return false;
}

function collectItemIds(items: RequirementResult[]): number[] {
  const ids = new Set<number>();
  const visit = (entries: RequirementResult[]) => {
    for (const entry of entries) {
      if (entry.requirement.type === 'item-possessed') {
        ids.add(entry.requirement.itemId);
      }
      if (entry.children && entry.children.length > 0) {
        visit(entry.children);
      }
    }
  };
  visit(items);
  return Array.from(ids);
}

const itemNameCache = new Map<number, string>();

async function fetchItemNames(ids: number[]): Promise<void> {
  const missing = ids.filter((id) => !itemNameCache.has(id));
  if (missing.length === 0) {
    return;
  }

  const chunkSize = 75;
  const chunks: number[][] = [];
  for (let i = 0; i < missing.length; i += chunkSize) {
    chunks.push(missing.slice(i, i + chunkSize));
  }

  await Promise.all(
    chunks.map(async (chunk) => {
      const params = new URLSearchParams({
        ids: chunk.join(','),
      });
      const response = await fetch(`/api/ge/mapping?${params.toString()}`);
      if (!response.ok) {
        return;
      }
      const payload = (await response.json()) as {
        data?: Array<{ id: number; name: string }>;
      };
      for (const item of payload.data ?? []) {
        if (Number.isFinite(item.id) && item.name) {
          itemNameCache.set(item.id, item.name);
        }
      }
    })
  );
}

export function formatRequirement(
  requirement: Requirement,
  itemNames?: ItemNameMap | null
) {
  switch (requirement.type) {
    case 'skill-level':
      return `${titleize(requirement.skill)} ${requirement.level}`;
    case 'combined-skill-level':
      return `Combined ${requirement.skills
        .map((skill) => titleize(skill))
        .join(' + ')} >= ${requirement.totalLevel}`;
    case 'combat-level':
      return `Combat level ${requirement.level}`;
    case 'quest-complete':
      return `Quest: ${titleize(requirement.questId)}`;
    case 'diary-complete':
      return `Diary: ${titleize(requirement.diaryId)} (${requirement.tier})`;
    case 'diary-task':
      return `Diary task: ${titleize(requirement.taskId)}`;
    case 'unlock-flag':
      return `Unlock: ${titleize(requirement.flagId)}`;
    case 'activity-score':
      return `Activity: ${titleize(requirement.activityKey)} >= ${requirement.score}`;
    case 'combat-achievement':
      return `Combat achievement: ${titleize(requirement.achievementId)}`;
    case 'item-possessed': {
      const name = itemNames?.[requirement.itemId];
      return `Item: ${name ?? requirement.itemId}`;
    }
    case 'manual-check':
      return requirement.label;
    case 'all-of':
      return 'All of';
    case 'any-of':
      return 'Any of';
    default:
      return 'Requirement';
  }
}

function RequirementListInner({ items }: { items: RequirementResult[] }) {
  const itemNames = useContext(ItemNameContext);

  if (!items.length) {
    return <div className="muted">No requirements listed.</div>;
  }

  return (
    <ul className="requirements-list">
      {items.map((item, index) => (
        <li key={`${item.requirement.type}-${index}`}>
          {!resultIsUntracked(item) && (
            <span className={statusClass(item.status)}>{item.status}</span>
          )}
          <span>{formatRequirement(item.requirement, itemNames)}</span>
          {item.children && item.children.length > 0 && (
            <RequirementList items={item.children} />
          )}
        </li>
      ))}
    </ul>
  );
}

export function RequirementList({ items }: { items: RequirementResult[] }) {
  const inherited = useContext(ItemNameContext);
  const isRoot = inherited === null;

  const itemIds = useMemo(
    () => (isRoot ? collectItemIds(items) : []),
    [isRoot, items]
  );
  const itemIdKey = useMemo(
    () => (isRoot ? itemIds.slice().sort((a, b) => a - b).join(',') : ''),
    [isRoot, itemIds]
  );

  const [itemNames, setItemNames] = useState<ItemNameMap>({});

  useEffect(() => {
    if (!isRoot || itemIds.length === 0) {
      return;
    }

    let cancelled = false;
    void (async () => {
      await fetchItemNames(itemIds);
      if (cancelled) return;
      const next: ItemNameMap = {};
      for (const [id, name] of itemNameCache.entries()) {
        next[id] = name;
      }
      setItemNames(next);
    })();

    return () => {
      cancelled = true;
    };
  }, [isRoot, itemIdKey]);

  if (!isRoot) {
    return <RequirementListInner items={items} />;
  }

  return (
    <ItemNameContext.Provider value={itemNames}>
      <RequirementListInner items={items} />
    </ItemNameContext.Provider>
  );
}
