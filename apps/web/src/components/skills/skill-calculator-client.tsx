'use client';

import type { ProgressSnapshot, SkillName } from '@skillbound/domain';
import { useEffect, useState } from 'react';

import type { CalculatorDataResponse } from '@/lib/calculators/skill-calculator-types';

import SkillCalculator from './skill-calculator';

type NavSessionResponse = {
  user: { id: string; name?: string | null; email?: string | null } | null;
  characters: Array<{ id: string; displayName: string; mode: string }>;
  activeCharacterId: string | null;
};

type SkillCalculatorClientProps = {
  initialSkill: SkillName;
  initialCalculator: CalculatorDataResponse;
  initialMode: string;
  initialUsername: string;
  initialCurrentLevel: string;
  initialCurrentXp: string;
  initialTargetLevel: string;
};

export function SkillCalculatorClient({
  initialSkill,
  initialCalculator,
  initialMode,
  initialUsername,
  initialCurrentLevel,
  initialCurrentXp,
  initialTargetLevel,
}: SkillCalculatorClientProps) {
  const [activeCharacterName, setActiveCharacterName] = useState<string | null>(
    null
  );
  const [snapshotSkills, setSnapshotSkills] = useState<
    ProgressSnapshot['skills'] | null
  >(null);

  useEffect(() => {
    let active = true;

    const loadActiveCharacter = async () => {
      try {
        const response = await fetch('/api/nav/session', {
          cache: 'no-store',
        });
        if (!response.ok) {
          return;
        }
        const payload = (await response.json()) as NavSessionResponse;
        if (!payload.activeCharacterId) {
          return;
        }
        const activeCharacter = payload.characters.find(
          (character) => character.id === payload.activeCharacterId
        );

        if (active && activeCharacter) {
          setActiveCharacterName(activeCharacter.displayName);
        }

        const dashboardResponse = await fetch(
          `/api/characters/${payload.activeCharacterId}/dashboard`,
          {
            cache: 'no-store',
          }
        );
        if (!dashboardResponse.ok) {
          return;
        }
        const dashboardPayload = (await dashboardResponse.json()) as {
          data?: { snapshot?: ProgressSnapshot | null };
        };
        const snapshot = dashboardPayload.data?.snapshot ?? null;
        if (active && snapshot?.skills) {
          setSnapshotSkills(snapshot.skills);
        }
      } catch {
        // Ignore personalization errors
      }
    };

    void loadActiveCharacter();
    return () => {
      active = false;
    };
  }, []);

  return (
    <SkillCalculator
      activeCharacterName={activeCharacterName}
      initialCalculator={initialCalculator}
      initialCurrentLevel={initialCurrentLevel}
      initialCurrentXp={initialCurrentXp}
      initialMode={initialMode}
      initialSkill={initialSkill}
      initialTargetLevel={initialTargetLevel}
      initialUsername={initialUsername}
      snapshotSkills={snapshotSkills}
    />
  );
}
