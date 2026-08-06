const { test, expect } = require('@playwright/test');
const routes = [
  ['/index.php', 'Mes budgets'],
  ['/objectives.php', 'Mes objectifs'],
  ['/liaison.php', 'Lier mes dépenses'],
  ['/pilotage.php', 'Tableau de bord']
];
const labels = routes.map(([, label]) => label);

for (const viewport of [{ width: 390, height: 844, columns: 2 }, { width: 1440, height: 900, columns: 4 }]) {
  for (const [route, active] of routes) {
    test(`navigation explicite ${route} à ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(route);
      const nav = page.getByRole('navigation', { name: 'Navigation principale' });
      await expect(nav.getByRole('link')).toHaveCount(4);
      expect(await nav.getByRole('link').allTextContents()).toEqual(labels);
      await expect(nav.getByRole('link', { name: active })).toHaveAttribute('aria-current', 'page');
      const columns = await nav.evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length);
      expect(columns).toBe(viewport.columns);
    });
  }
}
