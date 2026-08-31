const { test, expect } = require('@playwright/test');

const trackId = crypto.randomUUID();
const taskId = crypto.randomUUID();
const target = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

test.beforeAll(async ({ request }) => {
  let response = await request.post('/goals-v2-api.php?action=track', { data: { id: trackId, title: 'AUDIT Permis de conduire', category: 'AUDIT Projet personnel', icon_key: 'car', motivation: 'AUDIT Être autonome', success_definition: 'AUDIT Permis obtenu', resources: 'AUDIT Deux heures par semaine', obstacles: 'AUDIT Disponibilité' } });
  expect(response.ok()).toBeTruthy();
  response = await request.post('/goals-v2-api.php?action=task', { data: { id: taskId, track_id: trackId, title: 'AUDIT Déposer le dossier', target_date: target } });
  expect(response.ok()).toBeTruthy();
});

test.afterAll(async ({ request }) => {
  await request.post('/goals-v2-api.php?action=track_delete', { data: { id: trackId } });
});

for (const viewport of [
  { width: 320, height: 568 }, { width: 360, height: 800 },
  { width: 390, height: 844 }, { width: 430, height: 932 }
]) {
  test(`nouveau flux Objectifs ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/objectives.php');
    const goal = page.locator(`#track-${trackId}`);
    await expect(goal.getByRole('heading', { name: 'AUDIT Permis de conduire' })).toBeVisible();
    await expect(goal.getByText('AUDIT Projet personnel')).toBeVisible();
    await expect(goal.getByText('AUDIT Déposer le dossier')).toBeVisible();
    await goal.getByRole('button', { name: /Ouvrir le plan/ }).click();
    const drawer = page.getByRole('dialog', { name: 'AUDIT Permis de conduire' });
    await expect(drawer.getByText('AUDIT Permis obtenu')).toBeVisible();
    await expect(drawer.getByText('AUDIT Être autonome')).toBeVisible();
    await expect(drawer.getByText(/7 jours restants/)).toBeVisible();
    const dimensions = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    expect(dimensions[0]).toBeLessThanOrEqual(dimensions[1]);
  });
}

test('menus secondaires et formulaire daté', async ({ page }) => {
  await page.goto('/objectives.php');
  const goal = page.locator(`#track-${trackId}`);
  await goal.getByRole('button', { name: 'Actions de l’objectif' }).click();
  await expect(goal.getByRole('menuitem', { name: 'Modifier' }).first()).toBeVisible();
  await goal.getByRole('menuitem', { name: 'Modifier' }).first().click();
  await expect(page.getByRole('dialog', { name: 'Compléter mon plan' })).toBeVisible();
  await page.getByRole('dialog', { name: 'Compléter mon plan' }).getByRole('button', { name: 'Fermer' }).click();
  await goal.getByRole('button', { name: /Ouvrir le plan/ }).click();
  await page.getByRole('dialog', { name: 'AUDIT Permis de conduire' }).getByRole('button', { name: 'Ajouter une étape' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Nouvelle étape' });
  await expect(dialog.getByLabel('Date cible')).toBeVisible();
  await dialog.getByRole('button', { name: 'Fermer' }).click();
});

test('la progression vient des étapes terminées et peut être annulée', async ({ page }) => {
  await page.goto('/objectives.php');
  const goal = page.locator(`#track-${trackId}`);
  await goal.getByRole('button', { name: /Ouvrir le plan/ }).click();
  const drawer = page.getByRole('dialog', { name: 'AUDIT Permis de conduire' });
  await drawer.getByRole('button', { name: 'Terminer' }).click();
  await expect(drawer.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  await expect(drawer.getByText('Toutes les étapes sont terminées')).toBeVisible();
  await drawer.getByRole('button', { name: 'Rouvrir' }).click();
  await expect(drawer.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
});

test('un rappel J-7 est généré une seule fois et peut être lu', async ({ request }) => {
  let response = await request.get('/notifications-api.php?action=reminders');
  expect(response.ok()).toBeTruthy();
  let body = await response.json();
  const reminders = body.reminders.filter(r => r.task_id === taskId && r.reminder_type === 'j7');
  expect(reminders).toHaveLength(1);
  response = await request.get('/notifications-api.php?action=reminders');
  body = await response.json();
  expect(body.reminders.filter(r => r.task_id === taskId && r.reminder_type === 'j7')).toHaveLength(1);
  response = await request.post('/notifications-api.php?action=read', { data: { id: reminders[0].id } });
  expect(response.ok()).toBeTruthy();
});

test('les dates et identifiants invalides sont rejetés', async ({ request }) => {
  let response = await request.post('/goals-v2-api.php?action=task', { data: { id: crypto.randomUUID(), track_id: trackId, title: 'Invalide', target_date: 'garbage' } });
  expect(response.status()).toBe(422);
  response = await request.post('/goals-v2-api.php?action=task_update', { data: { id: crypto.randomUUID(), title: 'Absent', target_date: target } });
  expect(response.status()).toBe(404);
});
