import { expect, test } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('homepage loads successfully', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/OSRS Progression Tracker/i);
  });

  test('nav shows expected links for signed-out users', async ({ page }) => {
    await page.goto('/');
    const navLinks = page.locator('.nav-links');
    await expect(
      navLinks.getByRole('link', { name: 'Progression' })
    ).toBeVisible();
    await expect(navLinks.getByRole('link', { name: 'Guides' })).toBeVisible();
    await expect(navLinks.getByRole('link', { name: 'Trading' })).toBeVisible();
    await expect(
      navLinks.getByRole('link', { name: 'Calculators' })
    ).toBeVisible();
    await expect(navLinks.getByRole('link', { name: 'Lookup' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /new lookup/i })).toBeVisible();
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

  test('trading tracker redirects from legacy query', async ({ page }) => {
    await page.goto('/trading?tab=tracker');
    await expect(page).toHaveURL(/\/trading\/tracker/);
    await expect(
      page.getByRole('heading', { name: /login required/i })
    ).toBeVisible();
  });

  test('progression page is accessible', async ({ page }) => {
    await page.goto('/progression');
    await expect(
      page.getByRole('heading', { name: /progression tracker/i })
    ).toBeVisible();
  });
});
