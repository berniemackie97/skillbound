/**
 * Item Set Arbitrage
 *
 * Some GE items can be bought as a set and sold as individual pieces
 * (or vice versa) for profit. This module maps known sets to their
 * components and computes arbitrage opportunities.
 *
 * Example: "Bandos armour set" can be exchanged for Bandos chestplate,
 * tassets, and boots. If the set costs less than the sum of parts,
 * buying the set and selling individually is free profit.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ItemSetMapping {
  /** GE item ID of the boxed set */
  setId: number;
  /** Human-readable set name */
  setName: string;
  /** Individual components with their GE item IDs */
  components: Array<{
    itemId: number;
    itemName: string;
    quantity: number;
  }>;
}

export interface SetArbitrageResult {
  set: ItemSetMapping;
  setPrice: number | null;
  componentsTotalPrice: number | null;
  /** Positive = profit from buying set and selling parts */
  profitBuySet: number | null;
  /** Positive = profit from buying parts and selling set */
  profitBuyParts: number | null;
  /** Best direction to trade */
  direction: 'buy-set' | 'buy-parts' | 'none';
  /** Profit from the best direction */
  bestProfit: number | null;
}

// ---------------------------------------------------------------------------
// Known Item Sets (OSRS)
// ---------------------------------------------------------------------------

/**
 * Known item sets in OSRS that can be exchanged at the Grand Exchange.
 * The set item can be "opened" into individual pieces or individual
 * pieces can be "packed" into the set item via a GE clerk.
 *
 * IDs sourced from the OSRS Wiki.
 */
export const ITEM_SETS: ItemSetMapping[] = [
  // -- Barrows sets --
  {
    setId: 12873,
    setName: "Ahrim's armour set",
    components: [
      { itemId: 4708, itemName: "Ahrim's hood", quantity: 1 },
      { itemId: 4712, itemName: "Ahrim's robetop", quantity: 1 },
      { itemId: 4714, itemName: "Ahrim's robeskirt", quantity: 1 },
      { itemId: 4710, itemName: "Ahrim's staff", quantity: 1 },
    ],
  },
  {
    setId: 12875,
    setName: "Dharok's armour set",
    components: [
      { itemId: 4716, itemName: "Dharok's helm", quantity: 1 },
      { itemId: 4720, itemName: "Dharok's platebody", quantity: 1 },
      { itemId: 4722, itemName: "Dharok's platelegs", quantity: 1 },
      { itemId: 4718, itemName: "Dharok's greataxe", quantity: 1 },
    ],
  },
  {
    setId: 12877,
    setName: "Guthan's armour set",
    components: [
      { itemId: 4724, itemName: "Guthan's helm", quantity: 1 },
      { itemId: 4728, itemName: "Guthan's platebody", quantity: 1 },
      { itemId: 4730, itemName: "Guthan's chainskirt", quantity: 1 },
      { itemId: 4726, itemName: "Guthan's warspear", quantity: 1 },
    ],
  },
  {
    setId: 12879,
    setName: "Karil's armour set",
    components: [
      { itemId: 4732, itemName: "Karil's coif", quantity: 1 },
      { itemId: 4736, itemName: "Karil's leathertop", quantity: 1 },
      { itemId: 4738, itemName: "Karil's leatherskirt", quantity: 1 },
      { itemId: 4734, itemName: "Karil's crossbow", quantity: 1 },
    ],
  },
  {
    setId: 12881,
    setName: "Torag's armour set",
    components: [
      { itemId: 4745, itemName: "Torag's helm", quantity: 1 },
      { itemId: 4749, itemName: "Torag's platebody", quantity: 1 },
      { itemId: 4751, itemName: "Torag's platelegs", quantity: 1 },
      { itemId: 4747, itemName: "Torag's hammers", quantity: 1 },
    ],
  },
  {
    setId: 12883,
    setName: "Verac's armour set",
    components: [
      { itemId: 4753, itemName: "Verac's helm", quantity: 1 },
      { itemId: 4757, itemName: "Verac's brassard", quantity: 1 },
      { itemId: 4759, itemName: "Verac's plateskirt", quantity: 1 },
      { itemId: 4755, itemName: "Verac's flail", quantity: 1 },
    ],
  },

  // -- God Wars sets --
  {
    setId: 11828,
    setName: 'Bandos armour set',
    components: [
      { itemId: 11832, itemName: 'Bandos chestplate', quantity: 1 },
      { itemId: 11834, itemName: 'Bandos tassets', quantity: 1 },
      { itemId: 11836, itemName: 'Bandos boots', quantity: 1 },
    ],
  },
  {
    setId: 11830,
    setName: 'Armadyl armour set',
    components: [
      { itemId: 11826, itemName: 'Armadyl helmet', quantity: 1 },
      { itemId: 11828, itemName: 'Armadyl chestplate', quantity: 1 },
      { itemId: 11830, itemName: 'Armadyl chainskirt', quantity: 1 },
    ],
  },

  // -- Trimmed armour sets --
  {
    setId: 12960,
    setName: 'Rune armour set (lg)',
    components: [
      { itemId: 1163, itemName: 'Rune full helm', quantity: 1 },
      { itemId: 1127, itemName: 'Rune platebody', quantity: 1 },
      { itemId: 1079, itemName: 'Rune platelegs', quantity: 1 },
      { itemId: 1201, itemName: 'Rune kiteshield', quantity: 1 },
    ],
  },
  {
    setId: 12962,
    setName: 'Rune armour set (sk)',
    components: [
      { itemId: 1163, itemName: 'Rune full helm', quantity: 1 },
      { itemId: 1127, itemName: 'Rune platebody', quantity: 1 },
      { itemId: 1093, itemName: 'Rune plateskirt', quantity: 1 },
      { itemId: 1201, itemName: 'Rune kiteshield', quantity: 1 },
    ],
  },
  {
    setId: 13000,
    setName: 'Dragon armour set (lg)',
    components: [
      { itemId: 1149, itemName: 'Dragon med helm', quantity: 1 },
      { itemId: 14479, itemName: 'Dragon chainbody', quantity: 1 },
      { itemId: 4087, itemName: 'Dragon platelegs', quantity: 1 },
    ],
  },
  {
    setId: 13002,
    setName: 'Dragon armour set (sk)',
    components: [
      { itemId: 1149, itemName: 'Dragon med helm', quantity: 1 },
      { itemId: 14479, itemName: 'Dragon chainbody', quantity: 1 },
      { itemId: 4585, itemName: 'Dragon plateskirt', quantity: 1 },
    ],
  },
];

// ---------------------------------------------------------------------------
// Arbitrage Calculation
// ---------------------------------------------------------------------------

/**
 * Compute arbitrage profit for an item set.
 *
 * @param set - The item set mapping
 * @param prices - Map of itemId -> current buy price (instant buy / high price)
 */
export function computeSetArbitrage(
  set: ItemSetMapping,
  prices: Map<number, number | null>
): SetArbitrageResult {
  const setPrice = prices.get(set.setId) ?? null;

  // Sum up component prices
  let componentsTotalPrice: number | null = 0;
  for (const comp of set.components) {
    const price = prices.get(comp.itemId);
    if (price == null) {
      componentsTotalPrice = null;
      break;
    }
    componentsTotalPrice += price * comp.quantity;
  }

  let profitBuySet: number | null = null;
  let profitBuyParts: number | null = null;

  if (setPrice !== null && componentsTotalPrice !== null) {
    // Buy set, sell parts individually
    profitBuySet = componentsTotalPrice - setPrice;
    // Buy individual parts, sell as set
    profitBuyParts = setPrice - componentsTotalPrice;
  }

  let direction: 'buy-set' | 'buy-parts' | 'none' = 'none';
  let bestProfit: number | null = null;

  if (profitBuySet !== null && profitBuyParts !== null) {
    if (profitBuySet > 0 && profitBuySet >= profitBuyParts) {
      direction = 'buy-set';
      bestProfit = profitBuySet;
    } else if (profitBuyParts > 0) {
      direction = 'buy-parts';
      bestProfit = profitBuyParts;
    }
  }

  return {
    set,
    setPrice,
    componentsTotalPrice,
    profitBuySet,
    profitBuyParts,
    direction,
    bestProfit,
  };
}

/**
 * Scan all known item sets for arbitrage opportunities.
 *
 * @param prices - Map of itemId -> current buy price
 * @returns Arbitrage results sorted by best profit (descending)
 */
export function scanSetArbitrage(
  prices: Map<number, number | null>
): SetArbitrageResult[] {
  return ITEM_SETS.map((set) => computeSetArbitrage(set, prices))
    .filter((r) => r.bestProfit !== null && r.bestProfit > 0)
    .sort((a, b) => (b.bestProfit ?? 0) - (a.bestProfit ?? 0));
}
