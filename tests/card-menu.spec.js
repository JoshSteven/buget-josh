const { test, expect } = require('@playwright/test');

for (const width of [360, 390]) {
  test(`menu budget mobile à ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/index.php');
    await page.locator('[data-budget-select]').first().click();
    const more = page.getByRole('button', { name: 'Actions du budget' }).first();
    await expect(more).toBeVisible();
    await more.click();
    await expect(page.getByRole('menuitem', { name: 'Modifier le budget' }).first()).toBeVisible();
    const remove = page.getByRole('menuitem', { name: 'Supprimer le budget' }).first();
    await expect(remove).toBeVisible();
    await remove.click();
    const sheet = page.locator('dialog.confirm-sheet');
    await expect(sheet).toContainText('Attention');
    await expect(sheet).toContainText('irréversible');
    await sheet.getByRole('button', { name: 'Garder' }).click();
    await expect(sheet).toHaveCount(0);
    await expect(page.locator('[data-budget-select]')).toHaveCount(2);
    await expect(page.locator('body')).not.toHaveCSS('overflow-x', 'scroll');
  });
}
