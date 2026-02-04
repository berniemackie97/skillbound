import type { Requirement } from '@skillbound/domain';

/**
 * Type guards for runtime type validation
 * Replaces unsafe `as` type casts with proper type checking
 */

/**
 * Checks if a value is a valid Requirement object
 */
export function isRequirement(value: unknown): value is Requirement {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const req = value as Record<string, unknown>;

  // Check required fields based on Requirement type
  return (
    typeof req['type'] === 'string' &&
    (req['type'] === 'skill' ||
      req['type'] === 'quest' ||
      req['type'] === 'item' ||
      req['type'] === 'combat')
  );
}

/**
 * Checks if a value is an array of Requirements
 */
export function isRequirementArray(value: unknown): value is Requirement[] {
  return Array.isArray(value) && value.every(isRequirement);
}

/**
 * Safely converts unknown value to Requirement array
 * Returns empty array if invalid
 */
export function toRequirementArray(value: unknown): Requirement[] {
  if (isRequirementArray(value)) {
    return value;
  }
  return [];
}

/**
 * Checks if value is a plain object (not null, not array)
 */
export function isPlainObject(
  value: unknown
): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Checks if value is a valid diary achievements object
 * Format: { regionName: { tierName: { complete: boolean, tasks: boolean[] } } }
 */
export function isDiaryAchievementsObject(
  value: unknown
): value is Record<
  string,
  Record<string, { complete: boolean; tasks: boolean[] }>
> {
  if (!isPlainObject(value)) {
    return false;
  }

  // Check structure of nested objects
  for (const region of Object.values(value)) {
    if (!isPlainObject(region)) {
      return false;
    }

    for (const tier of Object.values(region)) {
      if (!isPlainObject(tier)) {
        return false;
      }

      if (
        typeof tier['complete'] !== 'boolean' ||
        !Array.isArray(tier['tasks'])
      ) {
        return false;
      }

      if (!tier['tasks'].every((task) => typeof task === 'boolean')) {
        return false;
      }
    }
  }

  return true;
}
