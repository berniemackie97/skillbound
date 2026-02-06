import { describe, expect, it } from 'vitest';

import { buildHomeSections } from './home-page-data';

const counts = {
  version: '2026-02-05',
  questCount: 229,
  diaryCount: 12,
  combatAchievementCount: 625,
};

describe('buildHomeSections', () => {
  it('keeps the homepage sections focused and removes legacy compare cards', () => {
    const sections = buildHomeSections(counts);
    const titles = sections.map((section) => section.title);

    expect(titles).toEqual(['Track your journey', 'Grand Exchange tools']);
  });

  it('routes trading CTAs to the correct tabs and anchors', () => {
    const sections = buildHomeSections(counts);
    const tradingSection = sections.find(
      (section) => section.title === 'Grand Exchange tools'
    );

    expect(tradingSection).toBeTruthy();
    if (!tradingSection) return;

    const tradeJournal = tradingSection.cards.find(
      (card) => card.title === 'Trade journal'
    );
    const liveAlerts = tradingSection.cards.find(
      (card) => card.title === 'Live alerts'
    );

    expect(tradeJournal?.cta.href).toBe('/trading/tracker#trade-history');
    expect(liveAlerts?.cta.href).toBe('/trading/tracker#live-alerts');
  });
});
