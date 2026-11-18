const { test, expect } = require('@playwright/test');

for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
  test(`saisir puis enregistrer une dépense à ${viewport.width}px, sans perte pendant un rechargement`, async ({ page }) => {
    const label = 'Dépense écran ' + Date.now();
    await page.setViewportSize(viewport);
    await page.goto('/index.php');
    await page.locator('[data-budget-select]').first().click();
    await page.locator('.card.active').getByRole('button', { name: 'Ajouter une dépense' }).last().click();
    const sheet = page.getByRole('dialog', { name: 'Nouvelle dépense' });
    await sheet.getByLabel('Libellé de la dépense').fill(label);
    await sheet.getByLabel('Montant de la dépense').fill('4321');

    // Un rechargement de l'écran (par exemple après une récurrence) ne doit plus effacer la saisie.
    await page.evaluate(() => window.dispatchEvent(new Event('budget:reload')));
    await page.waitForTimeout(400);
    await expect(sheet.getByLabel('Libellé de la dépense')).toHaveValue(label);

    await sheet.getByRole('button', { name: 'Prévue' }).click();
    await expect(sheet.getByRole('button', { name: '✓ Déjà réalisée' })).toBeVisible();
    await sheet.getByRole('button', { name: 'Enregistrer la dépense' }).click();
    await expect(sheet).toHaveCount(0);
    const entry = page.locator('.card.active .entry', { hasText: label });
    await expect(entry).toBeVisible();
    await expect(entry).toHaveClass(/realised/);
  });
}

test('annuler une dépense passe par la feuille de confirmation et la sort des totaux', async ({ page }) => {
  await page.goto('/index.php');
  const before = await page.evaluate(async () => (await (await fetch('api.php?action=bootstrap')).json()));
  const target = before.expenses.find(e => e.status === 'planned' && e.bucket === 'priority');
  const budgetBefore = before.totals[target.budget_id].planned;
  await page.locator(`[data-budget-select="${target.budget_id}"]`).click();
  const row = page.locator('.card.active .entry', { hasText: target.label });
  await row.getByRole('button', { name: 'Plus d’actions' }).click();
  await row.getByRole('menuitem', { name: 'Annuler la dépense' }).click();
  const sheet = page.locator('dialog.confirm-sheet');
  await expect(sheet).toContainText('exclue des totaux');
  await sheet.getByRole('button', { name: 'Annuler la dépense' }).click();
  await expect(row).toHaveClass(/cancelled/);
  const after = await page.evaluate(async () => (await (await fetch('api.php?action=bootstrap')).json()));
  expect(after.totals[target.budget_id].planned).toBeCloseTo(budgetBefore - Number(target.amount), 2);
  // Remise en état
  await row.getByRole('button', { name: 'Plus d’actions' }).click();
  await row.getByRole('menuitem', { name: 'Restaurer' }).click();
  await expect(row).not.toHaveClass(/cancelled/);
});
