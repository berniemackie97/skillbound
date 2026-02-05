import { expect, test } from '@playwright/test';

test.describe('API Health Checks', () => {
  test('health endpoint returns ok', async ({ page }) => {
    const response = await page.goto('/api/health');
    if (!response) {
      throw new Error('No response from /api/health');
    }
    expect(response.ok()).toBeTruthy();

    const body: unknown = await response.json();
    expect(body).toHaveProperty('status');
  });

  test('GE mapping endpoint returns data', async ({ page }) => {
    const response = await page.goto('/api/ge/mapping');
    if (!response) {
      throw new Error('No response from /api/ge/mapping');
    }
    expect(response.ok()).toBeTruthy();

    const body: unknown = await response.json();
    expect(body).toHaveProperty('data');
  });

  test('content quests endpoint returns data', async ({ page }) => {
    const response = await page.goto('/api/content/quests');
    if (!response) {
      throw new Error('No response from /api/content/quests');
    }
    expect(response.ok()).toBeTruthy();

    const body: unknown = await response.json();
    expect(body).toHaveProperty('data');
  });

  test('progression categories endpoint returns data', async ({ page }) => {
    const response = await page.goto('/api/progression/categories');
    if (!response) {
      throw new Error('No response from /api/progression/categories');
    }
    expect(response.ok()).toBeTruthy();

    const body: unknown = await response.json();
    expect(body).toHaveProperty('data');
  });
});
