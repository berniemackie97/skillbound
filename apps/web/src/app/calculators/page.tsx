import {
  getLevelForXp,
  getXpForLevel,
  MAX_LEVEL,
  SKILLS,
} from '@skillbound/domain';

import SkillCalculator from '@/components/skills/skill-calculator';
import { getSessionUser } from '@/lib/auth/auth-helpers';
import { getCalculatorDataForSkill } from '@/lib/calculators/skill-calculator-data';
import { getActiveCharacter } from '@/lib/character/character-selection';
import { getLatestCharacterSnapshot } from '@/lib/character/character-snapshots';

type SearchParams = Promise<{
  skill?: string | string[];
  currentLevel?: string | string[];
  currentXp?: string | string[];
  targetLevel?: string | string[];
  username?: string | string[];
  mode?: string | string[];
}>;

function getStringParam(value: string | string[] | undefined) {
  if (!value) {
    return '';
  }
  return Array.isArray(value) ? (value[0] ?? '') : value;
}

function parseNumber(value: string): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export default async function CalculatorsPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const resolvedSearchParams = await searchParams;
  const sessionUser = await getSessionUser();
  const activeSelection = sessionUser
    ? await getActiveCharacter(sessionUser.id)
    : null;
  const activeCharacter = activeSelection?.character ?? null;
  const activeSnapshot = activeCharacter
    ? await getLatestCharacterSnapshot(activeCharacter.id)
    : null;

  const skillParam = getStringParam(resolvedSearchParams?.skill).toLowerCase();
  const skill = (
    SKILLS.includes(skillParam as (typeof SKILLS)[number])
      ? skillParam
      : 'prayer'
  ) as (typeof SKILLS)[number];
  const currentLevelParam =
    getStringParam(resolvedSearchParams?.currentLevel) || '1';
  const currentXpParam = getStringParam(resolvedSearchParams?.currentXp) || '';
  const rawTargetLevelParam = getStringParam(resolvedSearchParams?.targetLevel);
  const usernameParam = getStringParam(resolvedSearchParams?.username).trim();
  const mode = getStringParam(resolvedSearchParams?.mode) || 'auto';

  const snapshotSkill = activeSnapshot?.skills.find(
    (entry) => entry.name === skill
  );
  const parsedLevel = parseNumber(currentLevelParam);

  let fallbackXpFromLevel: number | null = null;
  if (parsedLevel !== null) {
    try {
      fallbackXpFromLevel = getXpForLevel(parsedLevel);
    } catch {
      fallbackXpFromLevel = null;
    }
  }

  const resolvedCurrentXp =
    parseNumber(currentXpParam) ?? snapshotSkill?.xp ?? fallbackXpFromLevel;

  let resolvedCurrentLevel: number | null = null;
  if (resolvedCurrentXp !== null) {
    try {
      resolvedCurrentLevel = getLevelForXp(resolvedCurrentXp);
    } catch {
      resolvedCurrentLevel = null;
    }
  } else {
    resolvedCurrentLevel = parsedLevel;
  }

  const fallbackTargetLevel =
    resolvedCurrentLevel !== null
      ? Math.min(resolvedCurrentLevel + 1, MAX_LEVEL)
      : null;
  const targetLevelParam =
    rawTargetLevelParam ||
    (fallbackTargetLevel !== null ? String(fallbackTargetLevel) : '2');

  const calculator = await getCalculatorDataForSkill(skill);

  return (
    <SkillCalculator
      activeCharacterName={activeCharacter?.displayName ?? null}
      initialCalculator={calculator}
      initialMode={mode}
      initialSkill={skill}
      initialTargetLevel={targetLevelParam}
      initialUsername={usernameParam || activeCharacter?.displayName || ''}
      snapshotSkills={activeSnapshot?.skills ?? null}
      initialCurrentLevel={
        resolvedCurrentLevel?.toString() ?? currentLevelParam
      }
      initialCurrentXp={
        resolvedCurrentXp !== null ? String(resolvedCurrentXp) : currentXpParam
      }
    />
  );
}
