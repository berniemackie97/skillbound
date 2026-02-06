import {
  getLevelForXp,
  getXpForLevel,
  MAX_LEVEL,
  SKILLS,
} from '@skillbound/domain';

import { SkillCalculatorClient } from '@/components/skills/skill-calculator-client';
import { getCalculatorDataForSkill } from '@/lib/calculators/skill-calculator-data';
import { buildPageMetadata } from '@/lib/seo/metadata';

export const metadata = buildPageMetadata({
  title: 'OSRS Skill Calculators & XP Planner',
  description:
    'OSRS skill calculators for XP, levels, and targets. Plan efficient training routes with live data.',
  canonicalPath: '/calculators',
});

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

  const parsedLevel = parseNumber(currentLevelParam);

  let fallbackXpFromLevel: number | null = null;
  if (parsedLevel !== null) {
    try {
      fallbackXpFromLevel = getXpForLevel(parsedLevel);
    } catch {
      fallbackXpFromLevel = null;
    }
  }

  const resolvedCurrentXp = parseNumber(currentXpParam) ?? fallbackXpFromLevel;

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
    <SkillCalculatorClient
      initialCalculator={calculator}
      initialMode={mode}
      initialSkill={skill}
      initialTargetLevel={targetLevelParam}
      initialUsername={usernameParam}
      initialCurrentLevel={
        resolvedCurrentLevel?.toString() ?? currentLevelParam
      }
      initialCurrentXp={
        resolvedCurrentXp !== null ? String(resolvedCurrentXp) : currentXpParam
      }
    />
  );
}
