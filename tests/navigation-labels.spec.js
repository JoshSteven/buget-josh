const { test, expect } = require('@playwright/test');
const routes = [
  ['/index.php', 'Mes budgets'],
  ['/objectives.php', 'Mes objectifs'],
  ['/liaison.php', 'Lier mes dépenses'],
  ['/pilotage.php', 'Tableau de bord']
];
const shortLabels = ['Budgets', 'Objectifs', 'Liaisons', 'Tableau'];

for (const viewport of [{ width: 390, height: 844, mobile: true }, { width: 1440, height: 900, mobile: false }]) {
  for (const [route, active] of routes) {
    test(`navigation explicite ${route} à ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(route);
      const nav = page.getByRole('navigation', { name: 'Navigation principale' });
      await expect(nav.getByRole('link')).toHaveCount(4);
      await expect(nav.getByRole('link', { name: active })).toHaveAttribute('aria-current', 'page');
      const columns = await nav.evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length);
      expect(columns).toBe(4);
      await expect(nav.locator(viewport.mobile ? '.app-nav-label-short' : '.app-nav-label-full').first()).toBeVisible();
      if (viewport.mobile) {
        expect(await nav.locator('.app-nav-label-short').allTextContents()).toEqual(shortLabels);
        await expect(nav).toHaveCSS('position', 'fixed');
        const box = await nav.boundingBox();
        expect(Math.abs((box?.y || 0) + (box?.height || 0) - viewport.height)).toBeLessThanOrEqual(1);
      } else {
        await expect(nav).not.toHaveCSS('position', 'fixed');
      }
    });
  }
}
