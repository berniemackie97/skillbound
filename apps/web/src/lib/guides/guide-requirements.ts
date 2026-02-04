import type { GuideRequirement, GuideStep } from '@skillbound/database';
import {
  evaluateRequirementSet,
  isSkillName,
  type CharacterFacts,
  type Requirement,
  type RequirementResult,
  type RequirementStatus,
} from '@skillbound/domain';

type GuideRequirementEvaluation = {
  required: RequirementResult[];
  optional: RequirementResult[];
  status: RequirementStatus;
};

const UNKNOWN_STATUS: RequirementStatus = 'UNKNOWN';

function toRequirement(requirement: GuideRequirement): Requirement | null {
  switch (requirement.type) {
    case 'skill_level': {
      const skillValue = requirement.data['skill'];
      const skillIdValue = requirement.data['skillId'];
      const skill =
        typeof skillValue === 'string'
          ? skillValue
          : typeof skillIdValue === 'string'
            ? skillIdValue
            : null;
      const levelValue = requirement.data['level'];
      const level =
        typeof levelValue === 'number'
          ? levelValue
          : typeof levelValue === 'string'
            ? Number(levelValue)
            : null;
      if (!skill || !isSkillName(skill) || !Number.isFinite(level ?? NaN)) {
        return null;
      }
      return {
        type: 'skill-level',
        skill,
        level: Number(level),
      };
    }
    case 'quest_complete': {
      const questIdValue = requirement.data['questId'];
      const questId = typeof questIdValue === 'string' ? questIdValue : null;
      if (!questId) {
        return null;
      }
      return { type: 'quest-complete', questId };
    }
    case 'diary_complete': {
      const diaryIdValue = requirement.data['diaryId'];
      const tierValue = requirement.data['tier'];
      const diaryId = typeof diaryIdValue === 'string' ? diaryIdValue : null;
      const tier = typeof tierValue === 'string' ? tierValue : null;
      if (!diaryId || !tier) {
        return null;
      }
      return { type: 'diary-complete', diaryId, tier };
    }
    case 'unlock_flag': {
      const flagIdValue = requirement.data['flagId'];
      const flagId = typeof flagIdValue === 'string' ? flagIdValue : null;
      if (!flagId) {
        return null;
      }
      return { type: 'unlock-flag', flagId };
    }
    case 'manual_check': {
      const labelValue = requirement.data['label'];
      const label = typeof labelValue === 'string' ? labelValue : null;
      if (!label) {
        return null;
      }
      return { type: 'manual-check', label };
    }
    default:
      return null;
  }
}

function buildUnknownResult(requirements: Requirement[]): RequirementResult[] {
  return requirements.map((requirement) => ({
    requirement,
    status: UNKNOWN_STATUS,
  }));
}

export function evaluateGuideStepRequirements(
  step: GuideStep,
  facts: CharacterFacts | null
): GuideRequirementEvaluation {
  const required = (step.requirements ?? [])
    .map(toRequirement)
    .filter((value): value is Requirement => Boolean(value));
  const optional = (step.optionalRequirements ?? [])
    .map(toRequirement)
    .filter((value): value is Requirement => Boolean(value));

  if (!facts) {
    return {
      required: buildUnknownResult(required),
      optional: buildUnknownResult(optional),
      status: required.length > 0 ? UNKNOWN_STATUS : 'MET',
    };
  }

  return evaluateRequirementSet(required, optional, facts);
}
