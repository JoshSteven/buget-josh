const { test, expect } = require('@playwright/test');
const trackId = crypto.randomUUID();
const taskId = crypto.randomUUID();
const target = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

test.beforeAll(async ({ request }) => {
  await request.post('/goals-v2-api.php?action=track', { data: { id: trackId, title: 'AUDIT Notifications', category: 'AUDIT' } });
  await request.post('/goals-v2-api.php?action=task', { data: { id: taskId, track_id: trackId, title: 'AUDIT Échéance demain', target_date: target } });
  await request.get('/notifications-api.php?action=reminders');
});

test.afterAll(async ({ request }) => {
  await request.post('/goals-v2-api.php?action=track_delete', { data: { id: trackId } });
});

test('le centre affiche le rappel J-1 et la configuration push', async ({ page, request }) => {
  const config = await request.get('/notifications-api.php?action=config');
  expect(config.ok()).toBeTruthy();
  expect((await config.json()).available).toBeTruthy();
  await page.goto('/objectives.php');
  await expect(page.locator('#notificationBadge')).not.toBeHidden();
  await page.getByRole('button', { name: 'Ouvrir les rappels' }).click();
  const dialog = page.getByRole('dialog', { name: 'Rappels d’objectifs' });
  // On cible le rappel de CETTE tâche : la base de développement contient de vraies
  // données, et une autre échéance au lendemain produirait un second « Échéance demain ».
  const notice = dialog.getByRole('article').filter({ hasText: 'AUDIT Échéance demain' });
  await expect(notice).toHaveCount(1);
  await expect(notice.getByText('Échéance demain', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Activer les notifications' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Tester maintenant' })).toBeVisible();
});

test('les abonnements push non HTTPS sont rejetés', async ({ request }) => {
  const response = await request.post('/notifications-api.php?action=subscribe', { data: { endpoint: 'http://example.test/push', keys: { p256dh: 'x', auth: 'y' } } });
  expect(response.status()).toBe(422);
});

test('un test push exige un appareil préalablement enregistré', async ({ request }) => {
  const response = await request.post('/notifications-api.php?action=test', { data: { endpoint: 'https://example.test/push-not-registered' } });
  expect(response.status()).toBe(404);
  await expect(response.json()).resolves.toMatchObject({ error: /pas encore enregistré/ });
});

test('le service worker gère réception et clic sur notification', async ({ request }) => {
  const response = await request.get('/sw.js');
  const source = await response.text();
  expect(source).toContain("addEventListener('push'");
  expect(source).toContain("addEventListener('notificationclick'");
  expect(source).toContain('showNotification');
});
