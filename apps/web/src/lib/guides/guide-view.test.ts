import type { GuideStepSeed } from '@skillbound/content';
import { describe, expect, it } from 'vitest';

import { buildGuideChapters } from './guide-view';

const steps: GuideStepSeed[] = [
  {
    stepNumber: 1,
    title: 'Gather supplies',
    instructions: [
      {
        text: 'Withdraw coins from the bank',
        imageUrl: '/images/bank.png',
        imageAlt: 'Bank chest',
      },
    ],
    requirements: [],
    section: {
      id: 'prep',
      title: 'Preparation',
      description: 'Get ready',
      chapterTitle: 'Chapter One',
    },
  },
  {
    stepNumber: 2,
    title: 'Teleport',
    instructions: [
      {
        text: 'Use teleport tab',
        note: 'Bring a backup tab',
      },
    ],
    requirements: [],
    section: {
      id: 'prep',
      title: 'Preparation',
      description: 'Get ready',
      chapterTitle: 'Chapter One',
    },
  },
];

describe('buildGuideChapters', () => {
  it('groups steps into chapters and sections', () => {
    const chapters = buildGuideChapters(steps, null);

    expect(chapters).toHaveLength(1);
    const chapter = chapters[0];
    if (!chapter) {
      throw new Error('Expected a chapter to be created');
    }
    expect(chapter.title).toBe('Chapter One');
    expect(chapter.sections).toHaveLength(1);
    const section = chapter.sections[0];
    if (!section) {
      throw new Error('Expected a section to be created');
    }
    expect(section.steps).toHaveLength(2);
  });

  it('normalizes instruction fields without undefineds', () => {
    const chapters = buildGuideChapters(steps, null);
    const chapter = chapters[0];
    if (!chapter) {
      throw new Error('Expected a chapter to be created');
    }
    const section = chapter.sections[0];
    if (!section) {
      throw new Error('Expected a section to be created');
    }
    const instruction = section.steps[0]?.instructions?.[0];

    expect(instruction).toEqual({
      text: 'Withdraw coins from the bank',
      imageUrl: '/images/bank.png',
      imageAlt: 'Bank chest',
    });
  });
});
