<?php
declare(strict_types=1);

require_once __DIR__ . '/lib/bootstrap.php';

// Cron quotidien (20 h heure serveur) : génère les occurrences dues dans la Grâce de chaque mois.
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require __DIR__ . '/recurring-service.php';
$config = require __DIR__ . '/config.php';
$pdo = budgetDb();
$dryRun = in_array('--dry-run', $argv, true);
$stats = budgetRecurringGenerate($pdo, $dryRun);

echo json_encode([
    'models_due' => $stats['models'],
    'occurrences' => $stats['occurrences'],
    'created' => $stats['created'],
    'waiting_for_grace' => $stats['waiting'],
    'dry_run' => $dryRun,
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . PHP_EOL;
