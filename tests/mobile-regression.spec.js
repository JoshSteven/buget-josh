const { test, expect } = require('@playwright/test');

test('navigation mobile, animations et menu contextuel', async ({ page }) => {
  await page.goto('/index.php');
  await expect(page.locator('.app-nav a')).toHaveCount(4);
  expect(await page.locator('.app-nav a').first().evaluate(el => parseFloat(getComputedStyle(el).minHeight))).toBeGreaterThanOrEqual(48);
  expect(await page.evaluate(() => [typeof window.gsap, typeof window.Lenis])).toEqual(['object', 'function']);
  await page.locator('[data-budget-select]').first().click();
  await expect(page.getByRole('button', { name: 'Plus d’actions' }).first()).toBeVisible();
  await expect(page.getByText('Annuler', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Plus d’actions' }).first().click();
  await expect(page.getByRole('menuitem').first()).toBeVisible();
});

test('pilotage reçoit bien le type des dépenses', async ({ request }) => {
  const response = await request.get('/api.php?action=bootstrap');
  expect(response.ok()).toBeTruthy();
  const data = await response.json();
  for (const expense of data.expenses) expect(expense.type).toBeTruthy();
});

test('les mutations invalides sont refusées', async ({ request }) => {
  const negative = await request.post('/api.php?action=expense', { data: { amount: -1 } });
  expect(negative.status()).toBe(422);
  const month = await request.post('/goals-grid-api.php?action=task', { data: { id: crypto.randomUUID(), track_id: crypto.randomUUID(), goal_month: 'garbage', title: 'test' } });
  expect(month.status()).toBe(422);
  const missing = await request.post('/update-status.php', { data: { id: crypto.randomUUID(), status: 'planned' } });
  expect(missing.status()).toBe(404);
  const malformed = await request.fetch('/links-api.php', { method: 'POST', headers: { 'content-type': 'application/json' }, data: '{' });
  expect(malformed.status()).toBe(422);
});
