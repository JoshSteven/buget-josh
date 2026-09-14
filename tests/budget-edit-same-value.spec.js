const { test, expect } = require('@playwright/test');

test('modifier un budget avec la même valeur ne signale pas une disparition', async ({ page }) => {
  await page.goto('/index.php');
  const result = await page.evaluate(async () => {
    const response = await fetch('api.php?action=bootstrap');
    const data = await response.json();
    const budget = data.budgets.filter(item => item.kind === 'grace')
      .sort((a, b) => String(b.period_month).localeCompare(String(a.period_month)))[0].period_month;
    const target = data.budgets.find(item => item.kind === 'grace' && item.period_month === budget);
    const update = await fetch('api.php?action=budget_month', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: target.id, month: target.period_month }),
    });
    return { status: update.status, body: await update.json() };
  });
  expect(result.status).toBe(200);
  expect(result.body.ok).toBe(true);
});
