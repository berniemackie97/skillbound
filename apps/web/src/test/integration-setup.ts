/**
 * Integration test setup
 *
 * This file runs before all integration tests to set up the test environment.
 * It handles:
 * - Loading environment variables
 * - Setting up test database connection (if needed)
 * - Global test fixtures
 */

import { config } from 'dotenv';

// Load environment variables for tests
config({ path: '../../.env' });
config({ path: '../../.env.test', override: true });

// Set test-specific environment
(process.env as Record<string, string>)['NODE_ENV'] = 'test';
