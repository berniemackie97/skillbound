// Export all schemas
export * from './schema';

// Export client
export * from './client';

// Re-export drizzle helpers to avoid duplicate module instances in consumers
export {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  or,
  sql,
} from 'drizzle-orm';
