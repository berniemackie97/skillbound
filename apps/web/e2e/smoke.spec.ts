import { expect, test } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('homepage loads successfully', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Skillbound/i);
  });

  test('lookup page is accessible', async ({ page }) => {
    await page.goto('/lookup');
    await expect(
      page.getByRole('heading', { name: /character lookup/i })
    ).toBeVisible();
  });

  test('calculators page is accessible', async ({ page }) => {
    await page.goto('/calculators');
    await expect(page.locator('h1')).toBeVisible();
  });

  test('trading page is accessible', async ({ page }) => {
    await page.goto('/trading');
    await expect(page.locator('h1')).toBeVisible();
  });

  test('progression page is accessible', async ({ page }) => {
    await page.goto('/progression');
    await expect(
      page.getByRole('heading', { name: /progression tracker/i })
    ).toBeVisible();
  });
});
