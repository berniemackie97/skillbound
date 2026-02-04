'use client';

import type { Quest } from '@skillbound/content';
import type { RequirementResult, RequirementStatus } from '@skillbound/domain';
import { useState } from 'react';

import { RequirementList, statusClass } from '../requirements/requirements-ui';

interface QuestCardProps {
  quest: Quest;
  initialStatus: RequirementStatus;
  requirements: {
    required: RequirementResult[];
    optional: RequirementResult[];
  };
  characterId?: string;
  onStatusChange?: (questId: string, status: RequirementStatus) => void;
}

export function QuestCard({
  quest,
  initialStatus,
  requirements,
  characterId,
  onStatusChange,
}: QuestCardProps) {
  const [status, setStatus] = useState(initialStatus);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleStatusClick = async () => {
    // Cycle through: MET -> NOT_MET -> UNKNOWN -> MET
    const nextStatus: RequirementStatus =
      status === 'MET' ? 'NOT_MET' : status === 'NOT_MET' ? 'UNKNOWN' : 'MET';

    setStatus(nextStatus);
    setIsUpdating(true);

    try {
      if (characterId) {
        // Save to database via API for authenticated users
        const response = await fetch(
          `/api/characters/${characterId}/overrides`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'quest_complete',
              key: quest.id,
              value:
                nextStatus === 'MET'
                  ? 'true'
                  : nextStatus === 'NOT_MET'
                    ? 'false'
                    : 'null',
            }),
          }
        );

        if (!response.ok) {
          throw new Error('Failed to save override');
        }
      } else {
        // Save to localStorage for guest users
        const key = `quest_override_${quest.id}`;
        if (nextStatus === 'UNKNOWN') {
          localStorage.removeItem(key);
        } else {
          localStorage.setItem(key, nextStatus);
        }
      }

      onStatusChange?.(quest.id, nextStatus);
    } catch (error) {
      console.error('Failed to update quest status:', error);
      // Revert on error
      setStatus(initialStatus);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <article className="quest-card">
      <div className="quest-card-header">
        <h3>{quest.name}</h3>
        <button
          type="button"
          className={`${statusClass(status)} clickable ${isUpdating ? 'updating' : ''}`}
          onClick={handleStatusClick}
          disabled={isUpdating}
          title="Click to toggle quest completion status"
        >
          {status}
        </button>
      </div>
      <RequirementList items={requirements.required} />
      {requirements.optional.length > 0 && (
        <>
          <div className="label">Optional</div>
          <RequirementList items={requirements.optional} />
        </>
      )}
    </article>
  );
}
