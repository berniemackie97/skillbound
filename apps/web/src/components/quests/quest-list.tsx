'use client';

import type { Quest } from '@skillbound/content';
import type { RequirementResult, RequirementStatus } from '@skillbound/domain';
import { useEffect, useState } from 'react';

import { RequirementNamesProvider } from '../requirements/requirements-ui';

import { QuestCard } from './quest-card';

type QuestResult = {
  quest: Quest;
  completionStatus: RequirementStatus;
  requirements: {
    required: RequirementResult[];
    optional: RequirementResult[];
    status: RequirementStatus;
  };
};

interface QuestListProps {
  initialResults: QuestResult[];
  characterId?: string;
}

export function QuestList({ initialResults, characterId }: QuestListProps) {
  const [results, setResults] = useState(initialResults);

  // Load localStorage overrides for guest users on mount
  useEffect(() => {
    if (!characterId) {
      setResults((prev) =>
        prev.map((result) => {
          const override = localStorage.getItem(
            `quest_override_${result.quest.id}`
          );
          if (
            override === 'MET' ||
            override === 'NOT_MET' ||
            override === 'UNKNOWN'
          ) {
            return {
              ...result,
              completionStatus: override as RequirementStatus,
            };
          }
          return result;
        })
      );
    }
  }, [characterId]);

  const handleStatusChange = (
    questId: string,
    newStatus: RequirementStatus
  ) => {
    setResults((prev) =>
      prev.map((result) =>
        result.quest.id === questId
          ? { ...result, completionStatus: newStatus }
          : result
      )
    );
  };

  const requirementGroups: RequirementResult[][] = [];
  for (const result of results) {
    if (result.requirements.required.length > 0) {
      requirementGroups.push(result.requirements.required);
    }
    if (result.requirements.optional.length > 0) {
      requirementGroups.push(result.requirements.optional);
    }
  }

  return (
    <RequirementNamesProvider items={requirementGroups}>
      <div className="quest-grid">
        {results.map((item) => (
          <QuestCard
            key={item.quest.id}
            initialStatus={item.completionStatus}
            quest={item.quest}
            requirements={item.requirements}
            {...(characterId && { characterId })}
            onStatusChange={handleStatusChange}
          />
        ))}
      </div>
    </RequirementNamesProvider>
  );
}
