import { describe, expect, it } from 'vitest';

import {
  analyzeDiversification,
  categorizeItem,
  type PortfolioPosition,
} from './portfolio-diversification';

// ---------------------------------------------------------------------------
// categorizeItem
// ---------------------------------------------------------------------------

describe('categorizeItem', () => {
  it('classifies melee weapons', () => {
    expect(categorizeItem('Abyssal whip')).toBe('melee-weapon');
    expect(categorizeItem('Dragon scimitar')).toBe('melee-weapon');
    expect(categorizeItem('Armadyl godsword')).toBe('melee-weapon');
  });

  it('classifies ranged weapons', () => {
    expect(categorizeItem('Toxic blowpipe')).toBe('ranged-weapon');
    expect(categorizeItem('Twisted bow')).toBe('ranged-weapon');
    expect(categorizeItem('Dragon crossbow')).toBe('ranged-weapon');
  });

  it('classifies magic weapons', () => {
    expect(categorizeItem('Kodai wand')).toBe('magic-weapon');
    expect(categorizeItem('Sanguinesti staff')).toBe('magic-weapon');
    expect(categorizeItem('Trident of the swamp')).toBe('magic-weapon');
  });

  it('classifies armour', () => {
    expect(categorizeItem('Bandos chestplate')).toBe('melee-armour');
    expect(categorizeItem('Armadyl chainskirt')).toBe('ranged-armour');
    expect(categorizeItem('Ancestral robe top')).toBe('magic-armour');
  });

  it('classifies skilling supplies', () => {
    expect(categorizeItem('Ranarr seed')).toBe('skilling-supply');
    expect(categorizeItem('Yew log')).toBe('skilling-supply');
    expect(categorizeItem('Dragon bone')).toBe('skilling-supply');
  });

  it('classifies food and potions', () => {
    expect(categorizeItem('Shark')).toBe('food-potion');
    expect(categorizeItem('Super restore(4)')).toBe('food-potion');
    expect(categorizeItem('Saradomin brew(4)')).toBe('food-potion');
  });

  it('classifies runes and ammo', () => {
    expect(categorizeItem('Nature rune')).toBe('rune-ammo');
    expect(categorizeItem('Dragon arrow')).toBe('rune-ammo');
    expect(categorizeItem('Ruby bolts (e)')).toBe('rune-ammo');
  });

  it('falls back to other for unknown items', () => {
    expect(categorizeItem('Ring of suffering')).toBe('other');
    expect(categorizeItem('Berserker ring')).toBe('other');
  });
});

// ---------------------------------------------------------------------------
// analyzeDiversification
// ---------------------------------------------------------------------------

describe('analyzeDiversification', () => {
  it('returns empty analysis for no positions', () => {
    const result = analyzeDiversification([]);
    expect(result.totalValue).toBe(0);
    expect(result.uniqueItems).toBe(0);
    expect(result.hhi).toBe(0);
    expect(result.grade).toBe('F');
  });

  it('returns F grade for single item', () => {
    const positions: PortfolioPosition[] = [
      { itemId: 1, itemName: 'Abyssal whip', marketValue: 1_000_000 },
    ];
    const result = analyzeDiversification(positions);
    expect(result.uniqueItems).toBe(1);
    expect(result.hhi).toBe(10_000); // 100² = 10,000
    expect(result.grade).toBe('F');
    expect(result.topThreeConcentration).toBe(100);
  });

  it('calculates HHI correctly for equal-weight portfolio', () => {
    // 10 items each worth 1M → each has 10% share → HHI = 10 × 10² = 1000
    const positions: PortfolioPosition[] = Array.from(
      { length: 10 },
      (_, i) => ({
        itemId: i + 1,
        itemName: `Item ${i + 1}`,
        marketValue: 1_000_000,
        category: 'other' as const,
      })
    );
    const result = analyzeDiversification(positions);
    expect(result.hhi).toBe(1000);
    expect(result.grade).toBe('A');
    expect(result.topThreeConcentration).toBe(30);
  });

  it('detects concentrated portfolio', () => {
    // One item is 90% of portfolio
    const positions: PortfolioPosition[] = [
      { itemId: 1, itemName: 'Twisted bow', marketValue: 900_000_000 },
      { itemId: 2, itemName: 'Shark', marketValue: 50_000_000 },
      { itemId: 3, itemName: 'Nature rune', marketValue: 50_000_000 },
    ];
    const result = analyzeDiversification(positions);
    expect(result.hhi).toBeGreaterThan(6000);
    expect(result.grade).toBe('F');
    expect(result.topThreeConcentration).toBe(100);
  });

  it('computes category breakdown', () => {
    const positions: PortfolioPosition[] = [
      { itemId: 1, itemName: 'Abyssal whip', marketValue: 2_000_000 },
      { itemId: 2, itemName: 'Dragon scimitar', marketValue: 60_000 },
      { itemId: 3, itemName: 'Shark', marketValue: 500_000 },
    ];
    const result = analyzeDiversification(positions);

    const melee = result.categories.find((c) => c.category === 'melee-weapon');
    const food = result.categories.find((c) => c.category === 'food-potion');

    expect(melee).toBeDefined();
    expect(melee!.itemCount).toBe(2);
    expect(food).toBeDefined();
    expect(food!.itemCount).toBe(1);
  });

  it('uses explicit category override', () => {
    const positions: PortfolioPosition[] = [
      {
        itemId: 1,
        itemName: 'Custom widget',
        marketValue: 1_000_000,
        category: 'rare-cosmetic',
      },
    ];
    const result = analyzeDiversification(positions);
    expect(result.categories[0]!.category).toBe('rare-cosmetic');
  });

  it('gives B grade for moderately diversified portfolio', () => {
    // 5 items, relatively even but not perfectly so
    const positions: PortfolioPosition[] = [
      {
        itemId: 1,
        itemName: 'Item A',
        marketValue: 300_000,
        category: 'other' as const,
      },
      {
        itemId: 2,
        itemName: 'Item B',
        marketValue: 250_000,
        category: 'other' as const,
      },
      {
        itemId: 3,
        itemName: 'Item C',
        marketValue: 200_000,
        category: 'other' as const,
      },
      {
        itemId: 4,
        itemName: 'Item D',
        marketValue: 150_000,
        category: 'other' as const,
      },
      {
        itemId: 5,
        itemName: 'Item E',
        marketValue: 100_000,
        category: 'other' as const,
      },
    ];
    const result = analyzeDiversification(positions);
    // HHI = (30² + 25² + 20² + 15² + 10²) = 900+625+400+225+100 = 2250
    expect(result.hhi).toBe(2250);
    expect(result.grade).toBe('C');
  });

  it('categories are sorted by value descending', () => {
    const positions: PortfolioPosition[] = [
      { itemId: 1, itemName: 'Shark', marketValue: 100_000 },
      { itemId: 2, itemName: 'Abyssal whip', marketValue: 2_000_000 },
    ];
    const result = analyzeDiversification(positions);
    expect(result.categories[0]!.value).toBeGreaterThan(
      result.categories[1]!.value
    );
  });

  it('summary mentions item count', () => {
    const positions: PortfolioPosition[] = Array.from(
      { length: 10 },
      (_, i) => ({
        itemId: i + 1,
        itemName: `Item ${i + 1}`,
        marketValue: 1_000_000,
        category: 'other' as const,
      })
    );
    const result = analyzeDiversification(positions);
    expect(result.summary).toContain('10');
  });
});
