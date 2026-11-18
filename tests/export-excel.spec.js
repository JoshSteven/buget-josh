const { test, expect } = require('@playwright/test');
const fs = require('fs');

test('l’export produit un vrai fichier .xlsx depuis l’en-tête', async ({ page }) => {
  await page.goto('/index.php');
  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Exporter en Excel' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^budget-josh-\d{4}-\d{2}-\d{2}\.xlsx$/);
  const path = await file.path();
  const bytes = fs.readFileSync(path);
  // Un .xlsx est une archive ZIP : signature « PK ».
  expect(bytes.subarray(0, 2).toString()).toBe('PK');
  const content = bytes.toString('latin1');
  for (const part of ['xl/workbook.xml', 'xl/worksheets/sheet1.xml', 'xl/worksheets/sheet4.xml']) {
    expect(content).toContain(part);
  }
});

test('l’export exige une session', async ({ browser }) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const response = await context.request.get('/export-excel.php', { maxRedirects: 0 });
  expect([302, 303]).toContain(response.status());
  await context.close();
});
