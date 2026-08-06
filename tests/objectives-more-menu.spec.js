const { test, expect } = require('@playwright/test');

for (const mode of ['cartes', 'grille']) {
  test(`menu contextuel des objectifs en vue ${mode}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/objectives.php');
    if (mode === 'grille') await page.getByRole('button', { name: 'Vue grille' }).click();
    const more = page.getByRole('button', { name: 'Actions de l’objectif' }).first();
    await expect(more).toBeVisible();
    await more.click();
    await expect(page.getByRole('menuitem', { name: 'Modifier l’objectif' }).first()).toBeVisible();
    const remove = page.getByRole('menuitem', { name: 'Supprimer l’objectif' }).first();
    await expect(remove).toBeVisible();
    page.once('dialog', async dialog => {
      expect(dialog.message()).toContain('Attention');
      expect(dialog.message()).toContain('irréversible');
      await dialog.dismiss();
    });
    await remove.click();
  });
}
