import pino from 'pino';
import pinoPretty from 'pino-pretty';

/**
 * Enterprise-grade structured logger using Pino
 *
 * Usage:
 * ```ts
 * import { logger } from '@/lib/logging/logger';
 *
 * logger.info({ userId: '123', action: 'sync' }, 'Character synced successfully');
 * logger.error({ err }, 'Failed to sync character');
 * logger.warn({ count: 5 }, 'Rate limit approaching');
 * ```
 *
 * In production, logs are JSON formatted for easy parsing.
 * In development, logs are pretty-printed for readability.
 */
const isDevelopment = process.env['NODE_ENV'] === 'development';
const prettyStream = isDevelopment
  ? pinoPretty({
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname',
    })
  : undefined;

export const logger = pino(
  {
    level: process.env['LOG_LEVEL'] || 'info',
    formatters: {
      level: (label) => {
        return { level: label };
      },
    },
  },
  prettyStream
);

/**
 * Create a child logger with additional context
 *
 * Usage:
 * ```ts
 * const routeLogger = createLogger({ route: '/api/characters' });
 * routeLogger.info({ userId: '123' }, 'Request received');
 * ```
 */
export function createLogger(bindings: Record<string, unknown>) {
  return logger.child(bindings);
}
