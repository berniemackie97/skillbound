import type { GuideStep } from '@skillbound/database';
import { describe, expect, it } from 'vitest';

import { evaluateGuideStepRequirements } from './guide-requirements';

describe('evaluateGuideStepRequirements', () => {
  it('returns MET for steps without requirements', () => {
    const step: GuideStep = {
      stepNumber: 1,
      title: 'Test step',
      instructions: [],
      requirements: [],
      optionalRequirements: [],
    };

    const result = evaluateGuideStepRequirements(step, null);
    expect(result.status).toBe('MET');
    expect(result.required).toHaveLength(0);
  });

  it('returns UNKNOWN when requirements exist but facts are missing', () => {
    const step: GuideStep = {
      stepNumber: 2,
      title: 'Needs skills',
      instructions: [],
      requirements: [
        {
          type: 'skill_level',
          data: { skill: 'attack', level: 10 },
        },
      ],
      optionalRequirements: [],
    };

    const result = evaluateGuideStepRequirements(step, null);
    expect(result.status).toBe('UNKNOWN');
    expect(result.required[0]?.status).toBe('UNKNOWN');
  });
});
