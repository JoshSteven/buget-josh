<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

$config = require __DIR__ . '/config.php';
$pdo = new PDO(
    "mysql:host={$config['host']};dbname={$config['database']};charset=utf8mb4",
    $config['username'],
    $config['password'],
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
);
$dryRun = in_array('--dry-run', $argv, true);
$today = new DateTimeImmutable('today');
$models = $pdo->query(
    'SELECT r.id,r.budget_id,r.label,r.amount,r.bucket,r.nature,r.note,r.day_of_month,r.next_date
     FROM recurring_expenses r JOIN budgets b ON b.id=r.budget_id
     WHERE r.active=1 AND r.next_date<=CURDATE() ORDER BY r.next_date'
)->fetchAll(PDO::FETCH_ASSOC);
$created = 0;
$occurrences = 0;

function recurringNextDate(DateTimeImmutable $date, int $day): DateTimeImmutable
{
    $month = $date->modify('first day of next month');
    $safeDay = min($day, (int) $month->format('t'));
    return $month->setDate((int) $month->format('Y'), (int) $month->format('m'), $safeDay);
}

foreach ($models as $model) {
    $date = new DateTimeImmutable($model['next_date']);
    while ($date <= $today) {
        $occurrences++;
        if (!$dryRun) {
            $pdo->beginTransaction();
            try {
                $entryId = bin2hex(random_bytes(16));
                $run = $pdo->prepare(
                    'INSERT INTO recurring_expense_runs(recurring_id,occurrence_date,entry_id) VALUES(?,?,?)'
                );
                $run->execute([$model['id'], $date->format('Y-m-d'), $entryId]);
                $pdo->prepare(
                    "INSERT INTO entries(id,budget_id,type,amount,label,note,bucket,nature,status,entry_date,source)
                     VALUES(?,?, 'expense',?,?,?,?,?,'planned',?,'recurring')"
                )->execute([
                    $entryId, $model['budget_id'], $model['amount'], $model['label'], $model['note'],
                    $model['bucket'], $model['nature'], $date->format('Y-m-d'),
                ]);
                $created++;
                $pdo->commit();
            } catch (Throwable $error) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                if (!str_contains($error->getMessage(), 'Duplicate entry')) throw $error;
            }
        }
        $date = recurringNextDate($date, (int) $model['day_of_month']);
    }
    if (!$dryRun) {
        $pdo->prepare('UPDATE recurring_expenses SET next_date=? WHERE id=?')
            ->execute([$date->format('Y-m-d'), $model['id']]);
    }
}

echo json_encode([
    'models_due' => count($models),
    'occurrences' => $occurrences,
    'created' => $created,
    'dry_run' => $dryRun,
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . PHP_EOL;
