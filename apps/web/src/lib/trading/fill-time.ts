/**
 * Fill Time Estimation
 *
 * Estimates how long a GE offer will take to fill based on volume data
 * and buy limits. The GE has a 4-hour rolling buy limit per item, so
 * large orders may span multiple cycles.
 *
 * Factors:
 *   - Hourly trade volume
 *   - 4-hour buy limit
 *   - Order size relative to volume
 *   - Time of day (peak hours vs off-peak, optional)
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** GE buy limit resets every 4 hours */
const BUY_LIMIT_WINDOW_HOURS = 4;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FillTimeInput {
  /** Number of items in the order */
  quantity: number;
  /** 4-hour buy limit for this item */
  buyLimit: number | null;
  /** Estimated hourly volume (trades per hour) */
  hourlyVolume: number | null;
  /** Whether this is a buy or sell order */
  orderType: 'buy' | 'sell';
}

export interface FillTimeEstimate {
  /** Estimated total hours to fill */
  estimatedHours: number | null;
  /** Formatted human-readable string */
  formatted: string;
  /** Number of 4-hour buy limit cycles needed */
  cyclesNeeded: number | null;
  /** Whether the order exceeds one buy limit cycle */
  multiCycle: boolean;
  /** Confidence in the estimate */
  confidence: 'high' | 'medium' | 'low' | 'unknown';
  /** Rate-limiting factor */
  bottleneck: 'volume' | 'buy-limit' | 'none' | 'unknown';
}

// ---------------------------------------------------------------------------
// Estimation
// ---------------------------------------------------------------------------

/**
 * Estimate how long an order will take to fill on the GE.
 */
export function estimateFillTime(input: FillTimeInput): FillTimeEstimate {
  const { quantity, buyLimit, hourlyVolume, orderType } = input;

  // No data at all
  if (hourlyVolume === null && buyLimit === null) {
    return {
      estimatedHours: null,
      formatted: 'Unknown',
      cyclesNeeded: null,
      multiCycle: false,
      confidence: 'unknown',
      bottleneck: 'unknown',
    };
  }

  // Buy limits only apply to buys
  const effectiveBuyLimit =
    orderType === 'buy' && buyLimit !== null ? buyLimit : null;

  // Hours limited by volume (how fast the market can absorb)
  const volumeHours =
    hourlyVolume !== null && hourlyVolume > 0 ? quantity / hourlyVolume : null;

  // Hours limited by buy limit (how much GE lets you buy per cycle)
  let buyLimitHours: number | null = null;
  let cyclesNeeded: number | null = null;

  if (effectiveBuyLimit !== null && effectiveBuyLimit > 0) {
    cyclesNeeded = Math.ceil(quantity / effectiveBuyLimit);
    buyLimitHours = cyclesNeeded * BUY_LIMIT_WINDOW_HOURS;
  }

  // The binding constraint is whichever is slower
  let estimatedHours: number | null;
  let bottleneck: FillTimeEstimate['bottleneck'];

  if (volumeHours !== null && buyLimitHours !== null) {
    if (buyLimitHours > volumeHours) {
      estimatedHours = buyLimitHours;
      bottleneck = 'buy-limit';
    } else {
      estimatedHours = volumeHours;
      bottleneck = 'volume';
    }
  } else if (buyLimitHours !== null) {
    estimatedHours = buyLimitHours;
    bottleneck = 'buy-limit';
  } else if (volumeHours !== null) {
    estimatedHours = volumeHours;
    bottleneck = 'volume';
  } else {
    estimatedHours = null;
    bottleneck = 'unknown';
  }

  const multiCycle = cyclesNeeded !== null && cyclesNeeded > 1;

  // Confidence
  let confidence: FillTimeEstimate['confidence'];
  if (estimatedHours === null) {
    confidence = 'unknown';
  } else if (hourlyVolume !== null && hourlyVolume >= 100) {
    confidence = 'high';
  } else if (hourlyVolume !== null && hourlyVolume >= 10) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  // Round for display
  if (estimatedHours !== null) {
    estimatedHours = Math.round(estimatedHours * 100) / 100;
  }

  return {
    estimatedHours,
    formatted: formatFillTime(estimatedHours),
    cyclesNeeded,
    multiCycle,
    confidence,
    bottleneck,
  };
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

function formatFillTime(hours: number | null): string {
  if (hours === null) return 'Unknown';
  if (hours < 1 / 60) return '< 1 min';
  if (hours < 1) {
    const mins = Math.round(hours * 60);
    return `~${mins} min`;
  }
  if (hours < 24) {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return m > 0 ? `~${h}h ${m}m` : `~${h}h`;
  }
  const days = Math.round((hours / 24) * 10) / 10;
  return `~${days} days`;
}

/**
 * Estimate fill time for a flip (buy + sell cycle).
 * Returns combined estimate for both legs.
 */
export function estimateFlipCycleTime(
  quantity: number,
  buyLimit: number | null,
  hourlyVolume: number | null
): {
  buyEstimate: FillTimeEstimate;
  sellEstimate: FillTimeEstimate;
  totalHours: number | null;
  formatted: string;
} {
  const buyEstimate = estimateFillTime({
    quantity,
    buyLimit,
    hourlyVolume,
    orderType: 'buy',
  });

  const sellEstimate = estimateFillTime({
    quantity,
    buyLimit: null, // No buy limit on sells
    hourlyVolume,
    orderType: 'sell',
  });

  const totalHours =
    buyEstimate.estimatedHours !== null && sellEstimate.estimatedHours !== null
      ? Math.round(
          (buyEstimate.estimatedHours + sellEstimate.estimatedHours) * 100
        ) / 100
      : null;

  return {
    buyEstimate,
    sellEstimate,
    totalHours,
    formatted: formatFillTime(totalHours),
  };
}
