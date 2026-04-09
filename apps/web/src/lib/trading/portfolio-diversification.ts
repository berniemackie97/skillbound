/**
 * Portfolio Diversification Analysis
 *
 * Analyzes how diversified a character's trading portfolio is across
 * items and categories. Concentrated portfolios carry higher risk —
 * a single item crash can wipe out profits. This module computes
 * diversification metrics so users can make informed risk decisions.
 *
 * Metrics:
 *   - Herfindahl–Hirschman Index (HHI): Measures concentration (0–10,000)
 *   - Category distribution: Breakdown by OSRS item category
 *   - Top-heavy score: How much is allocated to the top N items
 *   - Diversification grade: A–F letter grade
 */

// ---------------------------------------------------------------------------
// OSRS item categories (simplified groupings for portfolio analysis)
// ---------------------------------------------------------------------------

export type ItemCategory =
  | 'melee-weapon'
  | 'ranged-weapon'
  | 'magic-weapon'
  | 'melee-armour'
  | 'ranged-armour'
  | 'magic-armour'
  | 'skilling-supply'
  | 'food-potion'
  | 'rune-ammo'
  | 'rare-cosmetic'
  | 'resource'
  | 'other';

/**
 * Known item-category mappings for common OSRS items.
 * In production this would come from the wiki sync / item DB;
 * for now we expose a helper that consumers can extend.
 */
const CATEGORY_KEYWORDS: Array<{ keywords: string[]; category: ItemCategory }> =
  [
    {
      keywords: [
        'whip',
        'scimitar',
        'godsword',
        'rapier',
        'mace',
        'sword',
        'dagger',
        'halberd',
        'bludgeon',
        'saeldor',
        'ghrazi',
        'blade',
        'hasta',
        'spear',
      ],
      category: 'melee-weapon',
    },
    {
      keywords: [
        'blowpipe',
        'crossbow',
        'bow',
        'chinchompa',
        'dart',
        'knife',
        'twisted bow',
        'zaryte',
      ],
      category: 'ranged-weapon',
    },
    {
      keywords: [
        'staff',
        'wand',
        'trident',
        'nightmare staff',
        'sanguinesti',
        'kodai',
        'harmonised',
        'volatile',
        'eldritch',
        'tome of fire',
      ],
      category: 'magic-weapon',
    },
    {
      keywords: [
        'platebody',
        'platelegs',
        'plateskirt',
        'full helm',
        'chainbody',
        'chestplate',
        'tassets',
        'bandos',
        'justiciar',
        'inquisitor',
        'torva',
      ],
      category: 'melee-armour',
    },
    {
      keywords: ['armadyl', 'karil', 'coif', 'leather', "d'hide", 'masori'],
      category: 'ranged-armour',
    },
    {
      keywords: ['ahrim', 'mystic', 'ancestral', 'infinity', 'virtus'],
      category: 'magic-armour',
    },
    {
      keywords: [
        'shark',
        'anglerfish',
        'manta',
        'brew',
        'restore',
        'potion',
        'prayer',
        'karambwan',
        'food',
        'pie',
        'stew',
      ],
      category: 'food-potion',
    },
    {
      keywords: [
        'ore',
        'bar',
        'log',
        'plank',
        'herb',
        'seed',
        'bone',
        'hide',
        'essence',
        'gem',
        'flax',
        'bowstring',
      ],
      category: 'skilling-supply',
    },
    {
      keywords: ['rune', 'arrow', 'bolt', 'cannonball', 'javelin', 'ammo'],
      category: 'rune-ammo',
    },
    {
      keywords: [
        'party hat',
        'partyhat',
        'santa',
        'mask',
        "h'ween",
        'halloween',
        '3rd age',
        'third age',
        'gilded',
      ],
      category: 'rare-cosmetic',
    },
    {
      keywords: [
        'coal',
        'iron',
        'gold',
        'mithril',
        'adamant',
        'runite',
        'dragon',
        'raw',
        'uncut',
      ],
      category: 'resource',
    },
  ];

/**
 * Guess an item's category from its name.
 * Falls back to 'other' if no keyword matches.
 */
export function categorizeItem(itemName: string): ItemCategory {
  const lower = itemName.toLowerCase();
  for (const entry of CATEGORY_KEYWORDS) {
    if (entry.keywords.some((kw) => lower.includes(kw))) {
      return entry.category;
    }
  }
  return 'other';
}

// ---------------------------------------------------------------------------
// Portfolio position input
// ---------------------------------------------------------------------------

export interface PortfolioPosition {
  itemId: number;
  itemName: string;
  /** Current market value of the position (quantity × price) */
  marketValue: number;
  /** Optional explicit category override */
  category?: ItemCategory | undefined;
}

// ---------------------------------------------------------------------------
// Diversification result
// ---------------------------------------------------------------------------

export interface CategoryAllocation {
  category: ItemCategory;
  label: string;
  /** Total value in this category */
  value: number;
  /** Percentage of total portfolio */
  percent: number;
  /** Number of distinct items */
  itemCount: number;
}

export interface DiversificationAnalysis {
  /** Total portfolio market value */
  totalValue: number;
  /** Number of distinct items held */
  uniqueItems: number;
  /** Herfindahl–Hirschman Index (0–10,000). Lower = more diversified */
  hhi: number;
  /** Percentage of value in top 3 items */
  topThreeConcentration: number;
  /** Category breakdown */
  categories: CategoryAllocation[];
  /** Overall diversification grade A–F */
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  /** Human-readable summary */
  summary: string;
}

// ---------------------------------------------------------------------------
// Category labels
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<ItemCategory, string> = {
  'melee-weapon': 'Melee Weapons',
  'ranged-weapon': 'Ranged Weapons',
  'magic-weapon': 'Magic Weapons',
  'melee-armour': 'Melee Armour',
  'ranged-armour': 'Ranged Armour',
  'magic-armour': 'Magic Armour',
  'skilling-supply': 'Skilling Supplies',
  'food-potion': 'Food & Potions',
  'rune-ammo': 'Runes & Ammo',
  'rare-cosmetic': 'Rares & Cosmetics',
  resource: 'Resources',
  other: 'Other',
};

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

/**
 * Compute diversification metrics for a set of portfolio positions.
 */
export function analyzeDiversification(
  positions: PortfolioPosition[]
): DiversificationAnalysis {
  if (positions.length === 0) {
    return {
      totalValue: 0,
      uniqueItems: 0,
      hhi: 0,
      topThreeConcentration: 0,
      categories: [],
      grade: 'F',
      summary: 'No positions to analyze.',
    };
  }

  const totalValue = positions.reduce((sum, p) => sum + p.marketValue, 0);

  // -- HHI calculation --
  // Sum of squared market-share percentages (each item's % of portfolio)
  let hhi = 0;
  if (totalValue > 0) {
    for (const pos of positions) {
      const share = (pos.marketValue / totalValue) * 100;
      hhi += share * share;
    }
  }
  hhi = Math.round(hhi);

  // -- Top 3 concentration --
  const sorted = [...positions].sort((a, b) => b.marketValue - a.marketValue);
  const topThreeValue = sorted
    .slice(0, 3)
    .reduce((sum, p) => sum + p.marketValue, 0);
  const topThreeConcentration =
    totalValue > 0 ? Math.round((topThreeValue / totalValue) * 10000) / 100 : 0;

  // -- Category breakdown --
  const catMap = new Map<ItemCategory, { value: number; items: Set<number> }>();

  for (const pos of positions) {
    const cat = pos.category ?? categorizeItem(pos.itemName);
    const existing = catMap.get(cat);
    if (existing) {
      existing.value += pos.marketValue;
      existing.items.add(pos.itemId);
    } else {
      catMap.set(cat, { value: pos.marketValue, items: new Set([pos.itemId]) });
    }
  }

  const categories: CategoryAllocation[] = [];
  for (const [cat, data] of catMap) {
    categories.push({
      category: cat,
      label: CATEGORY_LABELS[cat],
      value: data.value,
      percent:
        totalValue > 0
          ? Math.round((data.value / totalValue) * 10000) / 100
          : 0,
      itemCount: data.items.size,
    });
  }
  categories.sort((a, b) => b.value - a.value);

  // -- Grade --
  const grade = computeGrade(hhi, positions.length, topThreeConcentration);

  // -- Summary --
  const summary = buildSummary(
    grade,
    positions.length,
    hhi,
    topThreeConcentration
  );

  return {
    totalValue,
    uniqueItems: positions.length,
    hhi,
    topThreeConcentration,
    categories,
    grade,
    summary,
  };
}

// ---------------------------------------------------------------------------
// Grading
// ---------------------------------------------------------------------------

function computeGrade(
  hhi: number,
  itemCount: number,
  topThreePercent: number
): DiversificationAnalysis['grade'] {
  // Single item = F regardless
  if (itemCount <= 1) return 'F';

  // HHI thresholds (US DOJ uses 2500 for "highly concentrated")
  // We use game-appropriate thresholds:
  //   < 1500  = very diversified (A)
  //   < 2500  = moderately diversified (B)
  //   < 4000  = somewhat concentrated (C)
  //   < 6000  = concentrated (D)
  //   >= 6000 = highly concentrated (F)
  if (hhi < 1500 && topThreePercent < 60) return 'A';
  if (hhi < 2500 && topThreePercent < 75) return 'B';
  if (hhi < 4000) return 'C';
  if (hhi < 6000) return 'D';
  return 'F';
}

function buildSummary(
  grade: DiversificationAnalysis['grade'],
  itemCount: number,
  hhi: number,
  topThreePercent: number
): string {
  switch (grade) {
    case 'A':
      return `Well diversified across ${itemCount} items. Risk is spread evenly.`;
    case 'B':
      return `Moderately diversified across ${itemCount} items. Consider spreading into more categories.`;
    case 'C':
      return `Somewhat concentrated (HHI ${hhi}). Top 3 items hold ${topThreePercent}% of value.`;
    case 'D':
      return `Concentrated portfolio. Top 3 items hold ${topThreePercent}% of value — a single crash could hurt.`;
    case 'F':
      return itemCount <= 1
        ? 'Portfolio has only one item — extremely concentrated.'
        : `Highly concentrated (HHI ${hhi}). Diversify to reduce risk.`;
  }
}
