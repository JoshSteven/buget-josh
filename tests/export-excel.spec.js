const { test, expect } = require('@playwright/test');

test('exporte une synthèse Excel mise en forme', async ({ page }) => {
  await page.goto('/index.php');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Télécharger Excel' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^budget-josh-depenses-\d{4}-\d{2}-\d{2}\.xls$/);
});
