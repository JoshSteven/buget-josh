const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const { execFileSync } = require('child_process');
const path = require('path');

// Lot 14 : dépenses « au fur et à mesure ». Chaque test travaille dans son propre budget, supprimé à la fin.
const uuid = () => crypto.randomUUID();
const php = (script, ...args) => execFileSync(process.env.BUDGET_JOSH_PHP || 'php', [path.join(__dirname, script), ...args]).toString();
const post = async (request, url, data) => {
  const response = await request.post(url, { data });
  return { status: response.status(), body: await response.json() };
};
const bootstrap = async request => (await request.get('/api.php?action=bootstrap')).json();

async function makeBudget(request, name) {
  const id = uuid();
  const created = await post(request, '/api.php?action=budget', {
    id, kind: 'project', name, project_date: '2026-08-01', payment_id: uuid(), amount: 100000,
    payment_label: 'Fonds de test', payment_date: '2026-08-01', tithe_id: uuid(),
  });
  expect(created.status).toBe(200);
  return id;
}
const dropBudget = (request, id) => post(request, '/delete-budget.php', { id });

async function makeExpense(request, budgetId, extra = {}) {
  const id = uuid();
  const result = await post(request, '/api.php?action=expense', {
    id, budget_id: budgetId, label: 'Essence', amount: 15000, bucket: 'priority', status: 'planned', date: '2026-08-02',
    tracking: 'gradual', usual_amount: 3000, note: '', nature: 'Transport', ...extra,
  });
  expect(result.status).toBe(200);
  return id;
}
const add = (request, entryId, amount, id = uuid()) =>
  post(request, '/api.php?action=consumption_add', { id, entry_id: entryId, amount, date: '2026-08-03' });
const setStatus = (request, id, status) => post(request, '/update-status.php', { id, status });

/* ---------- Niveau 1 : la règle seule ---------- */

test('règle réalisé / prévu (unitaire, sans base)', () => {
  expect(php('entry-split.php')).toContain('OK 12 cas');
});

/* ---------- Niveau 2 : API, base et totaux ---------- */

test('la migration passe aussi quand la table des dépenses est en latin1, comme en production', () => {
  const output = php('migration-latin1.php');
  expect(output).toContain('OK latin1');
  expect(output).toContain('OK utf8mb4');
});

test('les passages avancent les totaux, le dépassement compte, la clôture libère le reste', async ({ request }) => {
  const budget = await makeBudget(request, 'Lot 14 totaux');
  try {
    const entry = await makeExpense(request, budget);
    const totals = async () => (await bootstrap(request)).totals[budget];
    // 10 000 de dîme prévue + 15 000 d'essence prévue.
    expect(await totals()).toMatchObject({ realised: 0, planned: 25000, available_real: 100000, available_committed: 75000 });

    const first = uuid();
    expect((await add(request, entry, 5000, first)).status).toBe(200);
    expect(await totals()).toMatchObject({ realised: 5000, planned: 20000, available_real: 95000, available_committed: 75000 });

    // La même demande rejouée (file hors connexion) ne compte qu'une fois.
    const replay = await add(request, entry, 5000, first);
    expect(replay.body).toMatchObject({ ok: true, duplicate: true });
    expect((await totals()).realised).toBe(5000);

    await add(request, entry, 12500);
    expect(await totals()).toMatchObject({ realised: 17500, planned: 10000, available_committed: 72500 });
    expect((await totals()).natures.Transport).toMatchObject({ realised: 17500, planned: 0 });

    await post(request, '/api.php?action=consumption_delete', { id: first });
    expect(await totals()).toMatchObject({ realised: 12500, planned: 12500 });

    expect((await setStatus(request, entry, 'realised')).status).toBe(200);
    expect(await totals()).toMatchObject({ realised: 12500, planned: 10000, available_committed: 77500 });
    // Clôturée : plus d'ajout, mais une demande déjà reçue reste acceptée.
    expect((await add(request, entry, 1000)).status).toBe(422);
    await setStatus(request, entry, 'planned');
    expect((await totals()).planned).toBe(12500);

    // Supprimer le budget efface aussi les passages.
    await dropBudget(request, budget);
    expect((await bootstrap(request)).consumptions.filter(c => c.entry_id === entry)).toHaveLength(0);
  } finally {
    await dropBudget(request, budget);
  }
});

test('les garde-fous du serveur', async ({ request }) => {
  const budget = await makeBudget(request, 'Lot 14 garde-fous');
  try {
    const gradual = await makeExpense(request, budget);
    const single = await makeExpense(request, budget, { label: 'Loyer', tracking: 'single', usual_amount: 500 });
    const data = await bootstrap(request);
    expect(data.expenses.find(e => e.id === single)).toMatchObject({ tracking: 'single', usual_amount: null });
    const tithe = data.expenses.find(e => e.budget_id === budget && e.bucket === 'tithe');

    for (const amount of [0, -500, 'abc']) expect((await add(request, gradual, amount)).status).toBe(422);
    expect((await post(request, '/api.php?action=consumption_add', { id: uuid(), entry_id: gradual, amount: 10, date: '2026-02-31' })).status).toBe(422);
    expect((await add(request, single, 500)).status).toBe(422);
    expect((await add(request, uuid(), 500)).status).toBe(404);
    const refused = await post(request, '/api.php?action=expense', {
      id: uuid(), budget_id: budget, label: 'x', amount: 10, bucket: 'dogs', status: 'realised', date: '2026-08-02', tracking: 'gradual',
    });
    expect(refused.status).toBe(422);
    expect((await post(request, '/api.php?action=expense_update', { id: tithe.id, label: tithe.label, amount: 10000, tracking: 'gradual' })).status).toBe(422);
    expect((await post(request, '/api.php?action=expense_update', { id: gradual, label: 'Essence', amount: 15000, tracking: 'autre' })).status).toBe(422);

    // Avec un passage : ni annulation, ni retour « En une fois ».
    const passage = uuid();
    await add(request, gradual, 2000, passage);
    expect((await setStatus(request, gradual, 'cancelled')).status).toBe(422);
    expect((await post(request, '/api.php?action=expense_update', { id: gradual, label: 'Essence', amount: 15000, tracking: 'single' })).status).toBe(422);
    // Modifier sans parler du suivi ne le change pas.
    await post(request, '/api.php?action=expense_update', { id: gradual, label: 'Carburant', amount: 16000 });
    expect((await bootstrap(request)).expenses.find(e => e.id === gradual))
      .toMatchObject({ label: 'Carburant', tracking: 'gradual', usual_amount: '3000.00', nature: 'Transport' });
    await post(request, '/api.php?action=consumption_delete', { id: passage });
    expect((await post(request, '/api.php?action=consumption_delete', { id: passage })).status).toBe(200);
    expect((await setStatus(request, gradual, 'cancelled')).status).toBe(200);
  } finally {
    await dropBudget(request, budget);
  }
});

test('changer de suivi garde les totaux', async ({ request }) => {
  const budget = await makeBudget(request, 'Lot 14 conversion');
  try {
    const entry = await makeExpense(request, budget, { tracking: 'single', status: 'realised', amount: 6000, label: 'Football' });
    const before = (await bootstrap(request)).totals[budget];
    expect((await post(request, '/api.php?action=expense_update', { id: entry, label: 'Football', amount: 6000, tracking: 'gradual', usual_amount: 2000 })).status).toBe(200);
    const data = await bootstrap(request);
    expect(data.totals[budget]).toMatchObject({ realised: before.realised, planned: before.planned });
    const passages = data.consumptions.filter(c => c.entry_id === entry);
    expect(passages).toHaveLength(1);
    expect(passages[0]).toMatchObject({ amount: '6000.00', date: '2026-08-02' });
    await post(request, '/api.php?action=consumption_delete', { id: passages[0].id });
    await setStatus(request, entry, 'realised');
    // Clôturée sans passage puis repassée « En une fois » : elle redevient prévue, pas réalisée d'office.
    await post(request, '/api.php?action=expense_update', { id: entry, label: 'Football', amount: 6000, tracking: 'single' });
    expect((await bootstrap(request)).expenses.find(e => e.id === entry)).toMatchObject({ tracking: 'single', status: 'planned', usual_amount: null });
  } finally {
    await dropBudget(request, budget);
  }
});

test('une récurrence au fur et à mesure crée une dépense au fur et à mesure', async ({ request }) => {
  const recurrence = uuid();
  const grace = uuid();
  const label = 'Football mensuel ' + Date.now();
  try {
    expect((await post(request, '/recurring-api.php?action=create', {
      id: recurrence, label, amount: 6000, bucket: 'dogs', start_date: '2027-05-04', nature: '', note: '', tracking: 'single',
    })).status).toBe(200);
    expect((await post(request, '/recurring-api.php?action=tracking', { id: recurrence, tracking: 'gradual', usual_amount: 2000 })).status).toBe(200);
    expect((await post(request, '/recurring-api.php?action=tracking', { id: uuid(), tracking: 'gradual' })).status).toBe(404);
    const created = await post(request, '/api.php?action=budget', {
      id: grace, kind: 'grace', period_month: '2027-05', payment_id: uuid(), amount: 50000, payment_label: 'Test lot 14',
      payment_date: '2027-04-30', tithe_id: uuid(),
    });
    expect(created.body.recurring_created).toBe(1);
    const data = await bootstrap(request);
    expect(data.expenses.find(e => e.label === label))
      .toMatchObject({ budget_id: grace, tracking: 'gradual', usual_amount: '2000.00', status: 'planned', source: 'recurring' });
  } finally {
    await post(request, '/recurring-api.php?action=delete', { id: recurrence });
    await dropBudget(request, grace);
  }
});

test('liaisons et export Excel reprennent le consommé', async ({ page, request }, testInfo) => {
  const budget = await makeBudget(request, 'Lot 14 export');
  const label = 'Essence export ' + Date.now();
  try {
    const entry = await makeExpense(request, budget, { label });
    await add(request, entry, 4000);
    const links = await (await request.get('/links-api.php')).json();
    expect(links.expenses.find(e => e.id === entry)).toMatchObject({ tracking: 'gradual', consumed: '4000.00' });
    await page.goto('/liaison.php');
    await expect(page.locator('.expense', { hasText: label })).toContainText('Au fur et à mesure');
    await expect(page.locator('.expense', { hasText: label }).locator('.expense-amount')).toContainText(/4.000 F CFA sur 15.000 F CFA/);

    const file = testInfo.outputPath('export.xlsx');
    require('fs').writeFileSync(file, await (await request.get('/export-excel.php')).body());
    const rows = JSON.parse(php('read-xlsx.php', file, 'Dépenses'));
    expect(rows[3].slice(5, 9)).toEqual(['Montant', 'Consommé', 'Reste prévu', 'Statut']);
    expect(rows.find(r => r[4] === label).slice(5, 9)).toEqual([15000, 4000, 11000, 'En cours']);
    // Les totaux de la feuille sont ceux du moteur de calcul.
    const data = await bootstrap(request);
    const total = key => Object.values(data.totals).reduce((n, t) => n + t[key], 0);
    expect(rows.find(r => r[4] === 'Total réalisé')[6]).toBe(total('realised'));
    expect(rows.find(r => r[4] === 'Total prévu')[7]).toBe(total('planned'));
  } finally {
    await dropBudget(request, budget);
  }
});

/* ---------- Niveau 3 : parcours dans le navigateur ---------- */

async function openBudget(page, id) {
  await page.goto('/index.php');
  await page.waitForLoadState('networkidle');
  await page.locator(`[data-budget-select="${id}"]`).click();
  await expect(page.locator(`[data-budget-card="${id}"]`)).toHaveClass(/active/);
}
const noOverflow = async page => expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);

for (const viewport of [{ width: 360, height: 760 }, { width: 1280, height: 900 }]) {
  test(`parcours complet au cadran à ${viewport.width}px`, async ({ page, request }) => {
    const budget = await makeBudget(request, `Lot 14 écran ${viewport.width}`);
    try {
      await page.setViewportSize(viewport);
      await openBudget(page, budget);
      const card = page.locator(`[data-budget-card="${budget}"]`);

      await card.getByRole('button', { name: 'Ajouter une dépense' }).first().click();
      const draft = page.getByRole('dialog', { name: 'Nouvelle dépense' });
      await draft.getByLabel('Libellé de la dépense').fill('Essence');
      await draft.getByLabel('Montant de la dépense').fill('15000');
      await expect(draft.getByLabel('Montant habituel d’un passage')).toBeHidden();
      await draft.getByRole('radio', { name: 'Au fur et à mesure' }).check();
      await expect(draft.getByRole('button', { name: 'Prévue' })).toBeHidden();
      await draft.getByLabel('Montant habituel d’un passage').fill('3000');
      await draft.getByRole('button', { name: 'Enregistrer la dépense' }).click();
      await expect(draft).toHaveCount(0);

      const row = card.locator('.entry.gradual', { hasText: 'Essence' });
      await expect(row.locator('.gauge-text')).toContainText(/0 sur 15.000 · reste 15.000/);
      await row.getByRole('button', { name: 'Ajouter un montant sur Essence' }).click();
      const sheet = page.getByRole('dialog', { name: 'Essence' });
      const slider = sheet.getByRole('slider', { name: 'Montant à ajouter' });

      // Rien n'est enregistré sans montant.
      await sheet.getByRole('button', { name: 'Ajouter', exact: true }).click();
      await expect(sheet.getByRole('status')).toContainText('Fais glisser');

      // Faire glisser avec le doigt (ou la souris) : le montant avance par pas de 500.
      const box = await slider.boundingBox();
      await page.mouse.move(box.x + 16, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * .4, box.y + box.height / 2, { steps: 8 });
      await page.mouse.up();
      const dragged = Number((await sheet.locator('[data-c="big"]').textContent()).replace(/\D/g, ''));
      expect(dragged).toBeGreaterThan(0);
      expect(dragged % 500).toBe(0);
      await expect(sheet.locator('[data-c="caption"]')).toHaveText('à ajouter');
      expect((await bootstrap(request)).totals[budget].realised).toBe(0);

      // Au clavier : revenir à zéro puis avancer de deux crans.
      await slider.press('Home');
      await slider.press('ArrowRight');
      await slider.press('ArrowRight');
      await expect(sheet.locator('[data-c="big"]')).toHaveText(/\+ 1.000/);
      await sheet.getByRole('button', { name: /^Ajouter 1.000 F CFA$/ }).click();
      await expect(sheet.getByRole('status')).toContainText(/1.000 F CFA ajoutés/);
      await expect(row.locator('.gauge-text')).toContainText(/1.000 sur 15.000/);

      // Le curseur ne recule pas sous ce qui est déjà consommé.
      await slider.press('Home');
      await expect(sheet.locator('[data-c="big"]')).toHaveText(/14.000/);

      await sheet.getByRole('button', { name: /^\+ 3.000$/ }).click();
      await sheet.getByRole('button', { name: /^Ajouter 3.000 F CFA$/ }).click();
      await expect(sheet.locator('.passage')).toHaveCount(2);

      await sheet.getByLabel('Montant exact').fill('12345');
      await expect(sheet.locator('[data-c="sum"]')).toContainText(/dépassement de 1.345/);
      await sheet.getByRole('button', { name: /^Ajouter 12.345 F CFA$/ }).click();
      await expect(row).toHaveClass(/over/);
      await expect(row.locator('.gauge-text')).toContainText(/dépassé de 1.345/);
      await noOverflow(page);
      const results = await new AxeBuilder({ page }).include('dialog.consume-sheet').analyze();
      expect(results.violations.filter(v => ['critical', 'serious'].includes(v.impact)).map(v => v.id + ' ' + v.nodes.map(n => n.target.join(' ')))).toEqual([]);

      // Retirer un passage passe par une confirmation.
      await sheet.locator('.passage', { hasText: /12.345/ }).getByRole('button').click();
      await page.locator('dialog.confirm-sheet').getByRole('button', { name: 'Retirer le passage' }).click();
      await expect(sheet.locator('.passage')).toHaveCount(2);
      await expect(row).not.toHaveClass(/over/);

      await sheet.getByRole('button', { name: 'Clôturer la dépense' }).click();
      const confirm = page.locator('dialog.confirm-sheet');
      await expect(confirm).toContainText(/11.000 F CFA restants redeviennent disponibles/);
      await confirm.getByRole('button', { name: 'Clôturer la dépense' }).click();
      await expect(sheet.getByRole('button', { name: 'Rouvrir la dépense' })).toBeVisible();
      await expect(slider).toBeHidden();
      await expect(row).toHaveClass(/realised/);
      expect((await bootstrap(request)).totals[budget]).toMatchObject({ realised: 4000, planned: 10000 });
      await sheet.getByRole('button', { name: 'Rouvrir la dépense' }).click();
      await expect(slider).toBeVisible();
      await sheet.getByRole('button', { name: 'Fermer' }).click();
      await expect(sheet).toHaveCount(0);

      // Menu : une dépense entamée se clôture mais ne s'annule pas.
      await row.getByRole('button', { name: 'Plus d’actions' }).click();
      await expect(row.getByRole('menuitem', { name: 'Clôturer la dépense' })).toBeVisible();
      await expect(row.getByRole('menuitem', { name: 'Annuler la dépense' })).toHaveCount(0);
    } finally {
      await dropBudget(request, budget);
    }
  });
}

test('modifier une dépense : passer « au fur et à mesure » depuis la fenêtre', async ({ page, request }) => {
  const budget = await makeBudget(request, 'Lot 14 modification');
  try {
    const entry = await makeExpense(request, budget, { tracking: 'single', status: 'realised', label: 'Football', amount: 6000, bucket: 'dogs' });
    await openBudget(page, budget);
    const row = page.locator(`[data-budget-card="${budget}"] .entry`, { hasText: 'Football' });
    await row.getByRole('button', { name: 'Plus d’actions' }).click();
    await row.getByRole('menuitem', { name: 'Modifier la dépense' }).click();
    const sheet = page.locator('dialog.edit-expense');
    await sheet.getByRole('radio', { name: 'Au fur et à mesure' }).check();
    await expect(sheet.locator('[data-hint]')).toContainText('premier passage');
    await sheet.getByLabel('Montant prévu').fill('8000');
    await sheet.getByLabel('Montant habituel (facultatif)').fill('2000');
    await noOverflow(page);
    await sheet.getByRole('button', { name: 'Enregistrer les modifications' }).click();
    await expect(sheet).toHaveCount(0);
    await expect(row.locator('.gauge-text')).toContainText(/6.000 sur 8.000 · reste 2.000/);
    expect((await bootstrap(request)).consumptions.filter(c => c.entry_id === entry)).toHaveLength(1);
  } finally {
    await dropBudget(request, budget);
  }
});

test('sans réseau : l’ajout se voit tout de suite et part une seule fois au retour', async ({ page, context, request }) => {
  const budget = await makeBudget(request, 'Lot 14 hors connexion');
  try {
    const entry = await makeExpense(request, budget);
    await openBudget(page, budget);
    // Le service worker doit contrôler la page, comme sur le téléphone.
    await page.evaluate(() => navigator.serviceWorker.ready);
    const card = page.locator(`[data-budget-card="${budget}"]`);
    const rows = await card.locator('.entry').count();

    await context.setOffline(true);
    await card.getByRole('button', { name: 'Ajouter un montant sur Essence' }).click();
    const sheet = page.getByRole('dialog', { name: 'Essence' });
    await sheet.getByRole('button', { name: /^\+ 3.000$/ }).click();
    await sheet.getByRole('button', { name: /^Ajouter 3.000 F CFA$/ }).click();
    await expect(sheet.getByRole('status')).toContainText('retour du réseau');
    await expect(sheet.locator('.passage')).toContainText('à envoyer');
    await sheet.getByRole('button', { name: 'Fermer' }).click();
    await expect(card.locator('.gauge-text')).toContainText(/3.000 sur 15.000/);
    await expect(card.locator('.card-head small')).toContainText(/97.000/);

    // Une modification hors connexion se voit aussi, sans ligne fantôme (défaut corrigé au lot 14).
    const row = card.locator('.entry', { hasText: 'Essence' });
    await row.getByRole('button', { name: 'Plus d’actions' }).click();
    await row.getByRole('menuitem', { name: 'Modifier la dépense' }).click();
    const edit = page.locator('dialog.edit-expense');
    await edit.getByLabel('Libellé').fill('Essence moto');
    await edit.getByRole('button', { name: 'Enregistrer les modifications' }).click();
    await expect(card.locator('.entry', { hasText: 'Essence moto' })).toHaveCount(1);
    await expect(card.locator('.entry')).toHaveCount(rows);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('budget-josh-offline-queue-v1')).length)).toBe(2);

    // Application rouverte, toujours sans réseau : les saisies en attente restent visibles.
    await page.reload();
    await page.locator(`[data-budget-select="${budget}"]`).click();
    await expect(card.locator('.entry', { hasText: 'Essence moto' }).locator('.gauge-text')).toContainText(/3.000 sur 15.000/);
    await expect(card.locator('.card-head small')).toContainText(/97.000/);

    // Le réseau revient et l'application est rouverte : la file part.
    // (Après un rechargement hors ligne, le navigateur de test n'émet plus l'événement « online ».)
    await context.setOffline(false);
    await page.reload();
    await expect.poll(async () => (await bootstrap(request)).consumptions.filter(c => c.entry_id === entry).length).toBe(1);
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('budget-josh-offline-queue-v1')).length)).toBe(0);
    const data = await bootstrap(request);
    expect(data.expenses.find(e => e.id === entry).label).toBe('Essence moto');
    expect(data.totals[budget].realised).toBe(3000);
  } finally {
    await context.setOffline(false);
    await dropBudget(request, budget);
  }
});

test('le réseau revient, application restée ouverte : la file part toute seule', async ({ page, context, request }) => {
  const budget = await makeBudget(request, 'Lot 14 retour réseau');
  try {
    const entry = await makeExpense(request, budget);
    await openBudget(page, budget);
    await context.setOffline(true);
    await page.getByRole('button', { name: 'Ajouter un montant sur Essence' }).click();
    const sheet = page.getByRole('dialog', { name: 'Essence' });
    await sheet.getByRole('button', { name: /^\+ 3.000$/ }).click();
    await sheet.getByRole('button', { name: /^Ajouter 3.000 F CFA$/ }).click();
    await expect(sheet.locator('.passage')).toContainText('à envoyer');
    await context.setOffline(false);
    await expect.poll(async () => (await bootstrap(request)).consumptions.filter(c => c.entry_id === entry).length).toBe(1);
    // La fenêtre restée ouverte se met à jour : le passage n'est plus « à envoyer ».
    await expect(sheet.locator('.passage')).not.toContainText('à envoyer');
  } finally {
    await context.setOffline(false);
    await dropBudget(request, budget);
  }
});

test('réseau instable : réessayer ne compte l’ajout qu’une fois', async ({ page, request }) => {
  const budget = await makeBudget(request, 'Lot 14 instable');
  try {
    const entry = await makeExpense(request, budget);
    await openBudget(page, budget);
    // La demande arrive au serveur, mais la réponse se perd.
    let lost = true;
    await page.context().route('**/api.php?action=consumption_add', async route => {
      if (!lost) return route.continue();
      lost = false;
      await route.fetch();
      await route.abort('connectionreset');
    });
    await page.getByRole('button', { name: 'Ajouter un montant sur Essence' }).click();
    const sheet = page.getByRole('dialog', { name: 'Essence' });
    await sheet.getByRole('button', { name: /^\+ 3.000$/ }).click();
    const button = sheet.getByRole('button', { name: /^Ajouter 3.000 F CFA$/ });
    await button.click();
    await expect(sheet.getByRole('status')).toContainText('réessaie');
    await button.click();
    await expect(sheet.getByRole('status')).toContainText('ajoutés');
    expect((await bootstrap(request)).consumptions.filter(c => c.entry_id === entry)).toHaveLength(1);
  } finally {
    await dropBudget(request, budget);
  }
});

test('récurrences : choisir puis changer le suivi dans la fenêtre', async ({ page }) => {
  const label = 'Récurrence cadran ' + Date.now();
  await page.goto('/index.php');
  await page.getByRole('button', { name: 'Dépenses récurrentes' }).click();
  const dialog = page.locator('dialog.recurring-dialog');
  await expect(dialog.locator('#recurringCount')).not.toBeEmpty();
  const newButton = dialog.getByRole('button', { name: '+ Nouvelle récurrence' });
  if (await newButton.isVisible()) await newButton.click();
  await dialog.locator('#recurringLabel').fill(label);
  await dialog.locator('#recurringAmount').fill('6000');
  await expect(dialog.locator('#recurringUsual')).toBeHidden();
  await dialog.locator('#recurringForm').getByRole('radio', { name: 'Au fur et à mesure' }).check();
  await dialog.locator('#recurringUsual').fill('2000');
  await dialog.locator('#recurringDate').fill('2099-02-10');
  await dialog.getByRole('button', { name: 'Créer la récurrence mensuelle' }).click();
  const item = dialog.locator('.recurring-item', { hasText: label });
  await expect(item).toContainText(/Au fur et à mesure · habituel 2.000/);

  await item.getByRole('button', { name: 'Changer le suivi de ' + label }).click();
  await item.getByRole('radio', { name: 'En une fois' }).check();
  await noOverflow(page);
  // Le panneau « Suivi » s'ouvre sous la récurrence, dans sa largeur (et non à côté, hors écran).
  const [outer, inner] = [await item.boundingBox(), await item.locator('.recurring-tracking').boundingBox()];
  expect(inner.x).toBeGreaterThanOrEqual(outer.x);
  expect(inner.x + inner.width).toBeLessThanOrEqual(outer.x + outer.width + 1);
  expect(inner.width).toBeGreaterThan(outer.width * .8);
  await item.getByRole('button', { name: 'Enregistrer le suivi' }).click();
  await expect(item).not.toContainText('Au fur et à mesure ·');
  await expect(item.locator('small')).toContainText('En une fois');

  await item.getByRole('button', { name: 'Supprimer ' + label }).click();
  await page.locator('dialog.confirm-sheet').getByRole('button', { name: 'Supprimer la récurrence' }).click();
  await expect(item).toHaveCount(0);
});
