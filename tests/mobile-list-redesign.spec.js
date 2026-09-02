const { test, expect } = require('@playwright/test');

for (const viewport of [
  { width: 320, height: 568 },
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 430, height: 932 }
]) {
  test(`liste compacte ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/index.php');
    await expect(page.locator('.art-bg')).toBeAttached();
    await page.locator('[data-budget-select]').first().click();
    await expect(page.locator('.card.active')).toHaveCount(1);
    const metrics = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
    expect(metrics.width).toBeLessThanOrEqual(metrics.client);
    const add = page.getByRole('button', { name: 'Ajouter une dépense' }).first();
    await add.click();
    const sheet = page.getByRole('dialog', { name: 'Nouvelle dépense' });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByLabel('Libellé de la dépense')).toBeFocused();
    await expect(sheet.getByRole('button', { name: 'Prévue' })).toBeVisible();
    await sheet.getByRole('button', { name: 'Fermer' }).click();
    await expect(sheet).toHaveCount(0);
  });
}

test('modifier une dépense est regroupé dans le menu contextuel', async ({ page }) => {
  await page.goto('/index.php');
  await page.locator('[data-budget-select]').first().click();
  await page.getByRole('button', { name: 'Plus d’actions' }).first().click();
  await expect(page.getByRole('menuitem', { name: 'Modifier la dépense' }).first()).toBeVisible();
});
