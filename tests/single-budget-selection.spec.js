const { test, expect } = require('@playwright/test');

for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test(`un seul budget actif à ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/index.php');
    const selectors = page.locator('[data-budget-select]');
    await expect(selectors).toHaveCount(2);
    await expect(page.locator('.card:visible')).toHaveCount(1);
    await expect(selectors.first()).toHaveClass(/active/);
    await selectors.nth(1).click();
    await expect(page.locator('.card:visible')).toHaveCount(1);
    await expect(selectors.nth(1)).toHaveClass(/active/);
    await expect(page.locator('.card:visible .card-head b')).toHaveText('AuthentiqueRacine');
  });
}
