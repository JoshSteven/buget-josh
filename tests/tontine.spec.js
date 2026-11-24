const { test, expect } = require('@playwright/test');

const bootstrap = page => page.evaluate(async () => (await fetch('api.php?action=bootstrap')).json());
const post = (page, url, data) => page.evaluate(async ([url, data]) => {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  return { status: r.status, body: await r.json() };
}, [url, data]);

test('créer une tontine depuis l’écran : aucune dîme, repère visible', async ({ page }) => {
  const name = 'Tontine bureau ' + Date.now();
  await page.goto('/index.php');
  await page.getByRole('button', { name: '+ Créer un budget' }).click();
  await page.locator('#kind').selectOption('tontine');
  await expect(page.locator('#titheNote')).toContainText('aucune dîme');
  await expect(page.getByText('Nom de la tontine')).toBeVisible();
  await page.locator('#projectName').fill(name);
  await page.locator('#projectDate').fill('2026-12-05');
  await page.locator('#paymentDate').fill('2026-12-05');
  await page.locator('#budgetAmount').fill('200000');
  await page.locator('#paymentLabel').fill('Ma main de tontine');
  await page.getByRole('button', { name: 'Valider' }).click();
  await expect(page.locator('#budgetDialog')).not.toBeVisible();

  const data = await bootstrap(page);
  const budget = data.budgets.find(b => b.name === name);
  expect(budget.kind).toBe('tontine');
  expect(data.expenses.filter(e => e.budget_id === budget.id && e.bucket === 'tithe')).toHaveLength(0);
  expect(data.totals[budget.id].available_real).toBe(200000);

  await page.locator(`[data-budget-select="${budget.id}"]`).click();
  await expect(page.locator('.card.active .kind-tag')).toHaveText('Tontine · sans dîme');

  // Un paiement ajouté ensuite ne crée pas non plus de dîme ; la feuille l'annonce.
  await page.getByRole('button', { name: 'Actions du budget' }).first().click();
  await page.locator(`[data-edit="${budget.id}"]`).click();
  const sheet = page.locator('dialog.edit-budget');
  await expect(sheet.locator('[data-row="0"] .pay-tithe')).toContainText('pas de dîme');
  await sheet.getByRole('button', { name: '+ Ajouter un paiement' }).click();
  await sheet.locator('[data-row="1"] [data-pay="amount"]').fill('50000');
  await sheet.locator('[data-row="1"] [data-pay="label"]').fill('Complément');
  await sheet.getByRole('button', { name: 'Enregistrer les modifications' }).click();
  await expect(sheet).toHaveCount(0);
  const after = await bootstrap(page);
  expect(after.totals[budget.id].received).toBe(250000);
  expect(after.expenses.filter(e => e.budget_id === budget.id && e.bucket === 'tithe')).toHaveLength(0);

  await post(page, 'delete-budget.php', { id: budget.id });
});

test('la règle est appliquée par le serveur : Grâce et Projet gardent toujours leur dîme', async ({ page }) => {
  await page.goto('/index.php');
  const id = crypto.randomUUID();
  const created = await post(page, 'api.php?action=budget', {
    id, kind: 'project', name: 'Projet test dîme', project_date: '2026-12-01', payment_id: crypto.randomUUID(),
    amount: 80000, payment_label: 'Acompte', payment_date: '2026-12-01', tithe_id: crypto.randomUUID(),
  });
  expect(created.status).toBe(200);
  const data = await bootstrap(page);
  expect(data.expenses.filter(e => e.budget_id === id && e.bucket === 'tithe').map(e => Number(e.amount))).toEqual([8000]);
  await post(page, 'delete-budget.php', { id });

  const bad = await post(page, 'api.php?action=budget', {
    id: crypto.randomUUID(), kind: 'epargne', name: 'x', project_date: '2026-12-01', payment_id: crypto.randomUUID(),
    amount: 1, payment_label: 'x', payment_date: '2026-12-01', tithe_id: crypto.randomUUID(),
  });
  expect(bad.status).toBe(422);
});
