<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
require __DIR__ . '/auth.php';
budgetRequireAuthApi();

function recurringFail(string $message, int $status = 422): never
{
    http_response_code($status);
    echo json_encode(['error' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    $config = require __DIR__ . '/config.php';
    $pdo = new PDO(
        "mysql:host={$config['host']};dbname={$config['database']};charset=utf8mb4",
        $config['username'],
        $config['password'],
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
    $action = $_GET['action'] ?? '';

    if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'list') {
        $rows = $pdo->query(
            'SELECT r.id,r.budget_id,r.label,r.amount,r.bucket,r.nature,r.note,r.frequency,r.start_date,r.next_date,r.active,
                    b.kind,b.name,b.period_month,b.project_date
             FROM recurring_expenses r JOIN budgets b ON b.id=r.budget_id
             ORDER BY r.active DESC,r.next_date ASC,r.created_at DESC'
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
        $budgetCheck = $pdo->prepare('SELECT COUNT(*) FROM budgets WHERE id=?');
        $budgetCheck->execute([(string) ($data['budget_id'] ?? '')]);
        if (!$budgetCheck->fetchColumn()) recurringFail('Budget introuvable.', 404);
        $pdo->prepare(
            'INSERT INTO recurring_expenses(id,budget_id,label,amount,bucket,nature,note,frequency,start_date,day_of_month,next_date)
             VALUES(?,?,?,?,?,?,?,"monthly",?,?,?)'
        )->execute([
            $data['id'], $data['budget_id'], $label, $amount, $bucket,
            trim((string) ($data['nature'] ?? '')) ?: null,
            trim((string) ($data['note'] ?? '')) ?: null,
            $date, (int) date('j', strtotime($date)), $date,
        ]);
        echo json_encode(['ok' => true]);
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
