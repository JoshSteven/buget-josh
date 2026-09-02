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
    page.once('dialog', async dialog => {
      expect(dialog.type()).toBe('confirm');
      expect(dialog.message()).toContain('Attention');
      expect(dialog.message()).toContain('irréversible');
      await dialog.dismiss();
    });
    await remove.click();
    await expect(page.locator('body')).not.toHaveCSS('overflow-x', 'scroll');
  });
}
