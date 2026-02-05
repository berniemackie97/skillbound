import {
  defineConfig,
  devices,
  type PlaywrightTestConfig,
} from '@playwright/test';

/**
 * Playwright E2E test configuration for Skillbound web app.
 * See https://playwright.dev/docs/test-configuration
 */
const config: PlaywrightTestConfig = {
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: process.env['CI'] ? 1 : 4,
  reporter: process.env['CI'] ? 'github' : 'html',
  use: {
    baseURL: process.env['PLAYWRIGHT_BASE_URL'] ?? 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  outputDir: 'test-results',
};

// Allow disabling the web server when an external dev server is already running.
if (process.env['PLAYWRIGHT_SKIP_WEBSERVER'] !== 'true') {
  config.webServer = {
    command: 'pnpm dev',
    url: process.env['PLAYWRIGHT_BASE_URL'] ?? 'http://127.0.0.1:3000',
    reuseExistingServer: true,
    timeout: 120000,
  };
}

export default defineConfig(config);
