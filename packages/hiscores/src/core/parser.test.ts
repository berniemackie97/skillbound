import { describe, expect, it } from 'vitest';

import { parseHiscoresCsv, parseHiscoresJson } from './parser';

describe('parseHiscoresJson', () => {
  it('normalizes keys and flags known skills', () => {
    const sample = {
      name: 'Test Player',
      skills: [
        { id: 0, name: 'Overall', rank: 1, level: 2277, xp: 4600000000 },
        { id: 1, name: 'Attack', rank: 2, level: 99, xp: 200000000 },
        { id: 24, name: 'Sailing', rank: 3, level: 70, xp: 5000000 },
        { id: 99, name: 'New Skill', rank: -1, level: -1, xp: -1 },
      ],
      activities: [
        { id: 1, name: 'Clue Scrolls (all)', rank: 10, score: 123 },
        {
          id: 5,
          name: 'Bounty Hunter (Legacy) - Hunter',
          rank: -1,
          score: -1,
        },
      ],
    };

    const result = parseHiscoresJson(sample, 'test player', 'normal');

    expect(result.displayName).toBe('Test Player');
    expect(result.username).toBe('test player');

    const overall = result.skills.find((skill) => skill.key === 'overall');
    const attack = result.skills.find((skill) => skill.key === 'attack');
    const sailing = result.skills.find((skill) => skill.key === 'sailing');
    const newSkill = result.skills.find((skill) => skill.key === 'new_skill');

    expect(overall?.isKnownSkill).toBe(true);
    expect(attack?.isKnownSkill).toBe(true);
    expect(sailing?.isKnownSkill).toBe(true);
    expect(newSkill?.isKnownSkill).toBe(false);

    const clueAll = result.activities.find(
      (activity) => activity.key === 'clue_scrolls_all'
    );
    const bountyLegacy = result.activities.find(
      (activity) => activity.key === 'bounty_hunter_legacy_hunter'
    );

    expect(clueAll?.name).toBe('Clue Scrolls (all)');
    expect(bountyLegacy?.name).toBe('Bounty Hunter (Legacy) - Hunter');
  });

  it('parses CSV with sailing and activities', () => {
    const skillLines = Array.from({ length: 25 }, (_, index) => {
      const rank = index === 0 ? 1 : index + 10;
      const level = index === 0 ? 2277 : 99;
      const xp = index === 0 ? 123456 : 200000000;
      return `${rank},${level},${xp}`;
    });

    const activityLines = ['1,10', '2,20'];
    const csv = [...skillLines, ...activityLines].join('\n');

    const result = parseHiscoresCsv(csv, 'csv_player', 'normal');

    expect(result.skills).toHaveLength(25);
    expect(result.skills.find((skill) => skill.key === 'sailing')).toBeTruthy();
    expect(result.activities).toHaveLength(2);
  });

  it('throws when CSV is too short', () => {
    const csv = '1,1,0';
    expect(() => parseHiscoresCsv(csv, 'csv_player', 'normal')).toThrow(
      'Invalid hiscores CSV'
    );
  });

  it('skips malformed CSV lines', () => {
    const skillLines = Array.from({ length: 25 }, () => '1,99,200000000');
    skillLines[0] = 'invalid';
    const csv = [...skillLines, '1,2'].join('\n');

    const result = parseHiscoresCsv(csv, 'csv_player', 'normal');
    expect(result.skills.length).toBeLessThan(25);
  });
});
