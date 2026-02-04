import type { PricesResponse } from '@skillbound/wiki-api/prices';

export function serializePricesResponse<T extends { itemId: number }>(
  response: PricesResponse<T>
) {
  return {
    timestamp: response.timestamp,
    prices: Array.from(response.prices.values()),
  };
}
