import { expect, test } from '@playwright/test';

test.describe('API Health Checks', () => {
  test('health endpoint returns ok', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body).toHaveProperty('status');
  });

  test('GE mapping endpoint returns data', async ({ request }) => {
    const response = await request.get('/api/ge/mapping');
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body).toHaveProperty('data');
  });

  test('content quests endpoint returns data', async ({ request }) => {
    const response = await request.get('/api/content/quests');
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body).toHaveProperty('data');
  });

  test('progression categories endpoint returns data', async ({ request }) => {
    const response = await request.get('/api/progression/categories');
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body).toHaveProperty('data');
  });
});
