<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
require __DIR__ . '/auth.php';
require __DIR__ . '/recurring-service.php';
budgetRequireAuthApi();

function recurringFail(string $message, int $status = 422): never
{
    http_response_code($status);
    echo json_encode(['error' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    $config = require __DIR__ . '/config.php';
    $pdo = budgetDb();
    $action = $_GET['action'] ?? '';

    if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'list') {
        $rows = $pdo->query(
            "SELECT r.id,r.label,r.amount,r.bucket,r.nature,r.note,r.frequency,r.start_date,r.day_of_month,r.next_date,r.active,
                    (SELECT COUNT(*) FROM recurring_expense_runs x WHERE x.recurring_id=r.id) AS generated_count,
                    EXISTS(SELECT 1 FROM budgets b WHERE b.kind='grace' AND b.period_month=DATE_FORMAT(r.next_date,'%Y-%m')) AS grace_ready
             FROM recurring_expenses r
             ORDER BY r.active DESC,r.next_date ASC,r.created_at DESC"
        )->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode(['recurrences' => $rows], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') recurringFail('Méthode non autorisée.', 405);
    $data = json_decode(file_get_contents('php://input'), true, 512, JSON_THROW_ON_ERROR);
    if (!is_array($data)) recurringFail('Données invalides.');

    if ($action === 'create') {
        $label = trim((string) ($data['label'] ?? ''));
        $amount = (float) ($data['amount'] ?? 0);
        $bucket = (string) ($data['bucket'] ?? '');
        $date = (string) ($data['start_date'] ?? '');
        if ($label === '' || $amount <= 0 || !in_array($bucket, ['priority', 'dogs'], true)
            || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            recurringFail('Libellé, montant, catégorie et date valides requis.');
        }
        $pdo->prepare(
            'INSERT INTO recurring_expenses(id,label,amount,bucket,nature,note,frequency,start_date,day_of_month,next_date)
             VALUES(?,?,?,?,?,?,"monthly",?,?,?)'
        )->execute([
            $data['id'], $label, $amount, $bucket,
            trim((string) ($data['nature'] ?? '')) ?: null,
            trim((string) ($data['note'] ?? '')) ?: null,
            $date, (int) date('j', strtotime($date)), $date,
        ]);
        // Si la Grâce du mois existe déjà, la dépense apparaît tout de suite comme prévue.
        $stats = budgetRecurringGenerate($pdo);
        echo json_encode(['ok' => true, 'created' => $stats['created']]);
        exit;
    }

    if ($action === 'toggle') {
        $query = $pdo->prepare('UPDATE recurring_expenses SET active=IF(active=1,0,1) WHERE id=?');
        $query->execute([(string) ($data['id'] ?? '')]);
        if (!$query->rowCount()) recurringFail('Récurrence introuvable.', 404);
        echo json_encode(['ok' => true]);
        exit;
    }

    if ($action === 'delete') {
        $pdo->prepare('DELETE FROM recurring_expense_runs WHERE recurring_id=?')->execute([(string) ($data['id'] ?? '')]);
        $query = $pdo->prepare('DELETE FROM recurring_expenses WHERE id=?');
        $query->execute([(string) ($data['id'] ?? '')]);
        if (!$query->rowCount()) recurringFail('Récurrence introuvable.', 404);
        echo json_encode(['ok' => true]);
        exit;
    }

    recurringFail('Action inconnue.', 404);
} catch (JsonException) {
    recurringFail('Données invalides.');
} catch (Throwable) {
    recurringFail('Impossible de gérer les dépenses récurrentes.', 500);
}
