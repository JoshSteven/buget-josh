<?php
declare(strict_types=1);

/*
 * Statut d'une dépense : prévue, réalisée ou annulée.
 * Dépense « au fur et à mesure » (lot 14) : « réalisée » veut dire clôturée, « prévue » ouverte.
 * Elle ne peut pas être annulée tant que des passages sont enregistrés (argent réellement sorti).
 */

require __DIR__ . '/auth.php';
budgetRequireAuthApi();

try {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') budgetFail('Méthode non autorisée.', 405);
    $d = budgetBody();
    $id = (string) ($d['id'] ?? '');
    $status = (string) ($d['status'] ?? '');
    if ($id === '' || !in_array($status, ['planned', 'realised', 'cancelled'], true)) budgetFail('Statut invalide.');

    $pdo = budgetDb();
    $query = $pdo->prepare(
        'SELECT e.tracking,(SELECT COUNT(*) FROM entry_consumptions c WHERE c.entry_id=e.id) passages
         FROM entries e WHERE e.id=?'
    );
    $query->execute([$id]);
    $entry = $query->fetch() ?: budgetFail('Dépense introuvable.', 404);
    if ($status === 'cancelled' && $entry['tracking'] === 'gradual' && (int) $entry['passages'] > 0) {
        budgetFail('Des passages sont déjà enregistrés : clôture la dépense, ou retire-les d’abord.');
    }
    $pdo->prepare('UPDATE entries SET status=? WHERE id=?')->execute([$status, $id]);
    budgetJson(['ok' => true]);
} catch (Throwable $error) {
    error_log('update-status.php : ' . $error->getMessage());
    budgetFail('Impossible de mettre à jour la dépense.', 500);
}
