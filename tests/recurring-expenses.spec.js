const { test, expect } = require('@playwright/test');

const post = (page, url, data) => page.evaluate(async ([url, data]) => {
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  return { status: response.status, body: await response.json() };
}, [url, data]);
const bootstrap = page => page.evaluate(async () => (await fetch('api.php?action=bootstrap')).json());
const recurrences = page => page.evaluate(async () => (await (await fetch('recurring-api.php?action=list')).json()).recurrences);

test('la fenêtre des récurrences s’ouvre depuis l’en-tête et explique la règle mensuelle', async ({ page }) => {
  await page.goto('/index.php');
  await page.getByRole('button', { name: 'Dépenses récurrentes' }).click();
  const dialog = page.locator('dialog.recurring-dialog');
  await expect(dialog.getByRole('heading', { name: 'Dépenses récurrentes' })).toBeVisible();
  await expect(dialog).toContainText('Grâce du mois');
  await expect(dialog.locator('#recurringBudget')).toHaveCount(0);
});

test('une récurrence attend la Grâce de son mois, puis y est ajoutée dès sa création', async ({ page }) => {
  const label = 'Récurrence mensuelle ' + Date.now();
  const recurrenceId = crypto.randomUUID();
  const graceId = crypto.randomUUID();
  await page.goto('/index.php');
  try {
    // Mars 2027 n'a pas encore de Grâce : la récurrence attend.
    const created = await post(page, 'recurring-api.php?action=create', {
      id: recurrenceId, label, amount: 4200, bucket: 'priority', start_date: '2027-03-05', nature: '', note: '',
    });
    expect(created.status).toBe(200);
    expect(created.body.created).toBe(0);
    let item = (await recurrences(page)).find(r => r.id === recurrenceId);
    expect(Number(item.grace_ready)).toBe(0);

    // Création de la Grâce de mars 2027 : l'occurrence y apparaît aussitôt comme prévue.
    const budget = await post(page, 'api.php?action=budget', {
      id: graceId, kind: 'grace', name: 'Grâce 2027-03', period_month: '2027-03', project_date: '2027-03-01',
      payment_id: crypto.randomUUID(), amount: 1000, payment_label: 'Test lot 11', payment_date: '2027-02-28', tithe_id: crypto.randomUUID(),
    });
    expect(budget.status).toBe(200);
    expect(budget.body.recurring_created).toBe(1);
    const data = await bootstrap(page);
    const entries = data.expenses.filter(e => e.label === label);
    expect(entries).toHaveLength(1);
    expect(entries[0].budget_id).toBe(graceId);
    expect(entries[0].status).toBe('planned');
    expect(entries[0].date).toBe('2027-03-05');

    // Avril 2027 n'existe pas : la récurrence attend de nouveau, sans doublon en mars.
    item = (await recurrences(page)).find(r => r.id === recurrenceId);
    expect(item.next_date).toBe('2027-04-05');
    expect(Number(item.grace_ready)).toBe(0);
    await post(page, 'recurring-api.php?action=create', {
      id: crypto.randomUUID(), label: label + ' bis', amount: 1, bucket: 'dogs', start_date: '2099-01-01', nature: '', note: '',
    }).then(async r => {
      const extra = (await recurrences(page)).find(x => x.label === label + ' bis');
      await post(page, 'recurring-api.php?action=delete', { id: extra.id });
    });
    expect((await bootstrap(page)).expenses.filter(e => e.label === label)).toHaveLength(1);
  } finally {
    await post(page, 'recurring-api.php?action=delete', { id: recurrenceId });
    await post(page, 'delete-budget.php', { id: graceId });
  }
});

test('lister, mettre en pause, puis supprimer avec la feuille de confirmation', async ({ page }) => {
  const label = 'Récurrence UI ' + Date.now();
  await page.goto('/index.php');
  await page.getByRole('button', { name: 'Dépenses récurrentes' }).click();
  const dialog = page.locator('dialog.recurring-dialog');
  const newButton = dialog.getByRole('button', { name: '+ Nouvelle récurrence' });
  await expect(dialog.locator('#recurringCount')).not.toBeEmpty();
  if (await newButton.isVisible()) await newButton.click();
  await dialog.locator('#recurringLabel').fill(label);
  await dialog.locator('#recurringAmount').fill('2500');
  await dialog.locator('#recurringDate').fill('2099-01-10');
  await dialog.getByRole('button', { name: 'Créer la récurrence mensuelle' }).click();

  const item = dialog.locator('.recurring-item', { hasText: label });
  await expect(item).toBeVisible();
  await expect(item).toContainText('le 10 de chaque mois');
  await expect(item).toContainText('En attente de la Grâce');

  await item.getByRole('button', { name: 'Mettre en pause' }).click();
  await expect(item).toContainText('En pause');
  await item.getByRole('button', { name: 'Reprendre' }).click();
  await expect(item).not.toContainText('En pause');

  // « Garder » annule la suppression.
  await item.getByRole('button', { name: 'Supprimer ' + label }).click();
  const sheet = page.locator('dialog.confirm-sheet');
  await expect(sheet.getByRole('heading', { name: `Supprimer « ${label} » ?` })).toBeVisible();
  await sheet.getByRole('button', { name: 'Garder' }).click();
  await expect(item).toBeVisible();

  await item.getByRole('button', { name: 'Supprimer ' + label }).click();
  await page.locator('dialog.confirm-sheet').getByRole('button', { name: 'Supprimer la récurrence' }).click();
  await expect(dialog.locator('.recurring-item', { hasText: label })).toHaveCount(0);
});
