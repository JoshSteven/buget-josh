const { test, expect } = require('@playwright/test');

// Simule dix budgets en dupliquant ceux de la base locale, sans rien écrire en base.
async function manyBudgets(page) {
  const seen = {};
  await page.route('**/api.php?action=bootstrap', async route => {
    const response = await route.fetch();
    const data = await response.json();
    const source = data.budgets[0];
    const extra = Array.from({ length: 10 }, (_, index) => ({
      ...source,
      id: 'fake-budget-' + index,
      kind: 'project',
      name: 'Projet ' + String(index + 1).padStart(2, '0'),
      period_month: null,
      project_date: '2026-0' + (1 + (index % 5)) + '-1' + index,
    }));
    const budgets = [...data.budgets, ...extra];
    budgets.forEach(b => { seen[b.id] = String(b.period_month || b.project_date); });
    await route.fulfill({ response, json: { ...data, budgets } });
  });
  return seen;
}

test('le plus récent est à gauche et la rangée ne revient pas au début après un choix', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const keys = await manyBudgets(page);
  await page.goto('/index.php');
  const strip = page.locator('#overview');
  const chips = strip.locator('[data-budget-select]');
  await expect(chips).toHaveCount(12);

  const order = await chips.evaluateAll(nodes => nodes.map(node => node.dataset.budgetSelect));
  const dates = order.map(id => keys[id]);
  expect(dates).toEqual([...dates].sort().reverse());

  await strip.evaluate(node => { node.scrollLeft = node.scrollWidth; });
  await page.waitForTimeout(150);
  const target = chips.nth(10);
  await target.click();
  await expect(target).toHaveClass(/active/);
  await page.waitForTimeout(600);
  const scrollAfter = await strip.evaluate(node => node.scrollLeft);
  expect(scrollAfter).toBeGreaterThan(200);
  const inView = await target.evaluate(chip => {
    const strip = chip.parentElement.getBoundingClientRect();
    const box = chip.getBoundingClientRect();
    return box.left >= strip.left - 1 && box.right <= strip.right + 1;
  });
  expect(inView).toBe(true);
});
