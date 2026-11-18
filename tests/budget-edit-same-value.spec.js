const { test, expect } = require('@playwright/test');

test('modifier un budget avec la même valeur ne signale pas une disparition', async ({ page }) => {
  await page.goto('/index.php');
  const result = await page.evaluate(async () => {
    const response = await fetch('api.php?action=bootstrap');
    const data = await response.json();
    const budget = data.budgets.filter(item => item.kind === 'grace')
      .sort((a, b) => String(b.period_month).localeCompare(String(a.period_month)))[0].period_month;
    const target = data.budgets.find(item => item.kind === 'grace' && item.period_month === budget);
    const update = await fetch('api.php?action=budget_month', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: target.id, month: target.period_month }),
    });
    return { status: update.status, body: await update.json() };
  });
  expect(result.status).toBe(200);
  expect(result.body.ok).toBe(true);
});

test('modifier une dépense ou un projet sans rien changer réussit, un identifiant inconnu échoue', async ({ page }) => {
  await page.goto('/index.php');
  const result = await page.evaluate(async () => {
    const post = async (action, body) => {
      const response = await fetch('api.php?action=' + action, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      return { status: response.status, body: await response.json() };
    };
    const data = await (await fetch('api.php?action=bootstrap')).json();
    const expense = data.expenses.find(item => ['priority', 'dogs', 'tithe'].includes(item.bucket));
    const project = data.budgets.find(item => item.kind === 'project');
    return {
      expense: await post('expense_update', { id: expense.id, label: expense.label, amount: Number(expense.amount) }),
      project: project ? await post('budget_label', { id: project.id, name: project.name }) : { status: 200, body: { ok: true } },
      missing: await post('expense_update', { id: 'inexistant', label: 'x', amount: 1 }),
    };
  });
  expect(result.expense.status).toBe(200);
  expect(result.project.status).toBe(200);
  expect(result.missing.status).toBe(404);
});
