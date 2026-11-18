const { test, expect } = require('@playwright/test');

test('le module des dépenses récurrentes est accessible', async ({ page }) => {
  await page.goto('/index.php');
  const button = page.getByRole('button', { name: 'Dépenses récurrentes' });
  await expect(button).toBeVisible();
  await button.click();
  await expect(page.getByRole('heading', { name: 'Dépenses récurrentes' })).toBeVisible();
  await expect(page.locator('#recurringBudget option')).not.toHaveCount(0);
});

test('une récurrence créée apparaît dans la liste, se met en pause et se supprime', async ({ page }) => {
  const label = 'Récurrence test ' + Date.now();
  page.on('dialog', dialog => dialog.accept());
  await page.goto('/index.php');
  await page.getByRole('button', { name: 'Dépenses récurrentes' }).click();
  const dialog = page.locator('dialog.recurring-dialog');
  await expect(dialog.locator('#recurringBudget option')).not.toHaveCount(0);

  const newButton = dialog.getByRole('button', { name: '+ Nouvelle récurrence' });
  if (await newButton.isVisible()) await newButton.click();
  await expect(dialog.getByRole('heading', { name: 'Nouvelle dépense récurrente' })).toBeVisible();
  await dialog.locator('#recurringLabel').fill(label);
  await dialog.locator('#recurringAmount').fill('2500');
  await dialog.getByRole('button', { name: 'Créer la récurrence mensuelle' }).click();

  const item = dialog.locator('.recurring-item', { hasText: label });
  await expect(item).toBeVisible();
  await expect(item).toContainText('2 500 F CFA');
  await expect(item).toContainText('Prochaine');
  await expect(dialog.locator('#recurringForm')).toBeHidden();

  await item.getByRole('button', { name: 'Mettre en pause' }).click();
  await expect(item).toContainText('En pause');
  await item.getByRole('button', { name: 'Reprendre' }).click();
  await expect(item).not.toContainText('En pause');

  await item.getByRole('button', { name: 'Supprimer ' + label }).click();
  await expect(dialog.locator('.recurring-item', { hasText: label })).toHaveCount(0);
});
