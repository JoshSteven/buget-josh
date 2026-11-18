const { test, expect } = require('@playwright/test');

test('une requête venant d’un autre site est refusée', async ({ request }) => {
  const response = await request.post('/api.php?action=expense_update', {
    headers: { Origin: 'https://site-malveillant.example' },
    data: { id: 'inexistant-123', label: 'x', amount: 1 },
  });
  expect(response.status()).toBe(403);
});

test('les montants et dates invalides sont refusés', async ({ request }) => {
  const data = await (await request.get('/api.php?action=bootstrap')).json();
  const budgetId = data.budgets[0].id;
  for (const amount of [0, -50, 'abc']) {
    const response = await request.post('/api.php?action=payment', {
      data: { id: crypto.randomUUID(), budget_id: budgetId, amount, label: 'Test', payment_date: '2026-07-01', tithe_id: crypto.randomUUID() },
    });
    expect(response.status()).toBe(422);
  }
  const badDate = await request.post('/api.php?action=expense', {
    data: { id: crypto.randomUUID(), budget_id: budgetId, amount: 10, label: 'Test', bucket: 'dogs', status: 'planned', date: '2026-02-31' },
  });
  expect(badDate.status()).toBe(422);
});

test('le moteur de calcul du serveur correspond au détail des dépenses (annulées exclues)', async ({ request }) => {
  const data = await (await request.get('/api.php?action=bootstrap')).json();
  for (const budget of data.budgets) {
    const rows = data.expenses.filter(e => e.budget_id === budget.id && e.type === 'expense' && e.status !== 'cancelled');
    const sum = list => list.reduce((n, e) => n + Number(e.amount), 0);
    const t = data.totals[budget.id];
    expect(t.received).toBeCloseTo(Number(budget.received), 2);
    expect(t.realised).toBeCloseTo(sum(rows.filter(e => e.status === 'realised')), 2);
    expect(t.planned).toBeCloseTo(sum(rows.filter(e => e.status === 'planned')), 2);
    expect(t.dogs.realised + t.dogs.planned).toBeCloseTo(sum(rows.filter(e => e.bucket === 'dogs')), 2);
    expect(t.available_committed).toBeCloseTo(t.received - t.realised - t.planned, 2);
  }
});

test('le Tableau de bord affiche les totaux du serveur', async ({ page }) => {
  await page.goto('/pilotage.php');
  const data = await page.evaluate(async () => (await fetch('api.php?action=bootstrap')).json());
  const received = Object.values(data.totals).reduce((n, t) => n + t.received, 0);
  const formatted = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(received) + ' F CFA';
  await expect(page.locator('#metrics .metric').first()).toContainText(formatted.replace(/ /g, ' '));
});
