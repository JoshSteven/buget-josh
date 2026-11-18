const { test, expect } = require('@playwright/test');

const GRACE = '11111111-1111-4111-8111-111111111111';
const GRACE_PAYMENT = 'a1111111-1111-4111-8111-111111111111';
const bootstrap = page => page.evaluate(async () => (await fetch('api.php?action=bootstrap')).json());
const post = (page, action, data) => page.evaluate(async ([action, data]) => {
  const r = await fetch('api.php?action=' + action, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  return { status: r.status, body: await r.json() };
}, [action, data]);

test('corriger le montant reçu : la dîme suit et la feuille l’annonce avant d’enregistrer', async ({ page }) => {
  await page.goto('/index.php');
  const before = await bootstrap(page);
  const payment = before.payments.find(p => p.id === GRACE_PAYMENT);
  await page.locator(`[data-budget-select="${GRACE}"]`).click();
  await page.getByRole('button', { name: 'Actions du budget' }).first().click();
  await page.locator(`[data-edit="${GRACE}"]`).click();

  const sheet = page.locator('dialog.edit-budget');
  await expect(sheet.getByRole('heading', { name: /Grâce/ })).toBeVisible();
  const amount = sheet.locator('[data-row="0"] [data-pay="amount"]');
  await expect(amount).toHaveValue(String(Number(payment.amount)));
  await amount.fill('300000');
  await expect(sheet.locator('[data-row="0"] .pay-tithe')).toContainText('→');
  await expect(sheet.locator('[data-row="0"] .pay-tithe')).toContainText('30 000');
  await expect(sheet.locator('.edit-warn')).toContainText('déjà marquée réalisée');
  await expect(sheet.locator('.edit-recap')).toContainText('300 000');
  // Une Grâce à un seul paiement ne propose pas de le supprimer.
  await expect(sheet.locator('.pay-remove')).toHaveCount(0);
  await sheet.getByRole('button', { name: 'Enregistrer les modifications' }).click();
  await expect(sheet).toHaveCount(0);

  const after = await bootstrap(page);
  expect(after.totals[GRACE].received).toBe(300000);
  const tithe = after.expenses.find(e => e.payment_id === GRACE_PAYMENT && e.bucket === 'tithe');
  expect(Number(tithe.amount)).toBe(30000);
  await expect(page.locator('.card.active .card-head small')).toContainText('300 000');

  // Remise en état pour les autres tests
  await post(page, 'payment_update', { id: GRACE_PAYMENT, amount: Number(payment.amount), label: payment.label, payment_date: payment.date });
});

test('ajouter puis supprimer un paiement, avec sa dîme', async ({ page }) => {
  const label = 'Complément ' + Date.now();
  await page.goto('/index.php');
  await page.locator(`[data-budget-select="${GRACE}"]`).click();
  await page.getByRole('button', { name: 'Actions du budget' }).first().click();
  await page.locator(`[data-edit="${GRACE}"]`).click();
  const sheet = page.locator('dialog.edit-budget');
  await sheet.getByRole('button', { name: '+ Ajouter un paiement' }).click();
  const row = sheet.locator('[data-row="1"]');
  await row.locator('[data-pay="amount"]').fill('50000');
  await row.locator('[data-pay="label"]').fill(label);
  await expect(row.locator('.pay-tithe')).toContainText('Nouvelle dîme : 5 000');
  await sheet.getByRole('button', { name: 'Enregistrer les modifications' }).click();
  await expect(sheet).toHaveCount(0);

  let data = await bootstrap(page);
  const added = data.payments.find(p => p.label === label);
  expect(added).toBeTruthy();
  expect(data.expenses.find(e => e.payment_id === added.id && e.bucket === 'tithe').amount).toBe('5000.00');

  // Suppression : bouton Supprimer, puis confirmation au style de l'application.
  await page.getByRole('button', { name: 'Actions du budget' }).first().click();
  await page.locator(`[data-edit="${GRACE}"]`).click();
  const index = await sheet.locator('[data-pay="label"]').evaluateAll((inputs, label) => inputs.findIndex(i => i.value === label), label);
  await sheet.locator(`[data-row="${index}"] .pay-remove`).click();
  await expect(sheet.locator(`[data-row="${index}"] .pay-tithe`)).toContainText('seront supprimés');
  await sheet.getByRole('button', { name: 'Enregistrer les modifications' }).click();
  await page.locator('dialog.confirm-sheet').getByRole('button', { name: 'Supprimer et enregistrer' }).click();
  await expect(sheet).toHaveCount(0);
  data = await bootstrap(page);
  expect(data.payments.find(p => p.label === label)).toBeUndefined();
  expect(data.expenses.find(e => e.payment_id === added.id)).toBeUndefined();
});

test('l’API refuse de supprimer le dernier paiement et renvoie le changement de dîme', async ({ page }) => {
  await page.goto('/index.php');
  const last = await post(page, 'payment_delete', { id: GRACE_PAYMENT });
  expect(last.status).toBe(422);
  const data = await bootstrap(page);
  const payment = data.payments.find(p => p.id === GRACE_PAYMENT);
  const same = await post(page, 'payment_update', { id: GRACE_PAYMENT, amount: Number(payment.amount), label: payment.label, payment_date: payment.date });
  expect(same.status).toBe(200);
  expect(same.body.tithe.after).toBe(Math.round(Number(payment.amount) * .1));
});
