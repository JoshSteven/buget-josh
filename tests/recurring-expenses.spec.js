const { test, expect } = require('@playwright/test');

test('le module des dépenses récurrentes est accessible', async ({ page }) => {
  await page.goto('/index.php');
  const button = page.getByRole('button', { name: 'Dépenses récurrentes' });
  await expect(button).toBeVisible();
  await button.click();
  await expect(page.getByRole('heading', { name: 'Nouvelle dépense récurrente' })).toBeVisible();
  await expect(page.locator('#recurringBudget option')).not.toHaveCount(0);
});
