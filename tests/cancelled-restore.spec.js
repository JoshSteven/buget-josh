const { test, expect } = require('@playwright/test');

// Signalé par Josh le 27 novembre 2026 : « Restaurer » restait sans effet. La transparence posée sur
// toute la ligne annulée emprisonnait son menu, que la dépense annulée suivante recouvrait.
const uuid = () => crypto.randomUUID();
const post = async (request, url, data) => expect((await request.post(url, { data })).status()).toBe(200);

for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
  test(`restaurer une dépense suivie d’une autre annulée à ${viewport.width}px`, async ({ page, request }) => {
    const budget = uuid();
    await post(request, '/api.php?action=budget', {
      id: budget, kind: 'project', name: `Restauration ${viewport.width}`, project_date: '2026-08-01',
      payment_id: uuid(), amount: 50000, payment_label: 'Fonds de test', payment_date: '2026-08-01', tithe_id: uuid(),
    });
    try {
      // La plus récente s'affiche en premier.
      for (const [label, date] of [['Annulée du haut', '2026-08-03'], ['Annulée du bas', '2026-08-02']]) {
        const id = uuid();
        await post(request, '/api.php?action=expense', { id, budget_id: budget, label, amount: 2000, bucket: 'priority', status: 'planned', date });
        await post(request, '/update-status.php', { id, status: 'cancelled' });
      }
      await page.setViewportSize(viewport);
      await page.goto('/index.php');
      await page.locator(`[data-budget-select="${budget}"]`).click();
      const row = page.locator(`[data-budget-card="${budget}"] .entry`, { hasText: 'Annulée du haut' });
      await row.getByRole('button', { name: 'Plus d’actions' }).click();
      const restore = row.getByRole('menuitem', { name: 'Restaurer' });
      await expect(restore).toBeVisible();

      // Rien ne doit recouvrir le bouton, sur toute sa surface.
      await expect.poll(() => restore.evaluate(button => {
        button.scrollIntoView({ block: 'center' });
        const box = button.getBoundingClientRect();
        return [.15, .5, .85].flatMap(y => [.1, .5, .9].map(x => document.elementFromPoint(box.left + box.width * x, box.top + box.height * y)))
          .filter(element => element !== button).length;
      })).toBe(0);

      await restore.click();
      await expect(row).not.toHaveClass(/cancelled/);
      await expect(row).toContainText('prévue');
    } finally {
      await post(request, '/delete-budget.php', { id: budget });
    }
  });
}
