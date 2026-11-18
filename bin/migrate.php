<?php
declare(strict_types=1);

/*
 * Applique les migrations SQL pas encore passées (lot Fondations).
 *
 *   php bin/migrate.php            applique ce qui manque
 *   php bin/migrate.php --dry-run  liste seulement ce qui serait appliqué
 *
 * La table schema_migrations retient chaque fichier appliqué. À sa toute première
 * création, les migrations historiques (lots 2 à 11), déjà appliquées à la main en
 * production, sont enregistrées comme faites sans être rejouées.
 * Nouvelles migrations : database/lot-12-....sql, etc., ajoutées aux exceptions de .gitignore.
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require dirname(__DIR__) . '/lib/bootstrap.php';

const BUDGET_HISTORICAL_MIGRATIONS = [
    'lot-2-migration.sql', 'lot-4-migration.sql', 'lot-5-objectives-notifications.sql', 'lot-6-goal-planning.sql',
    'lot-7-daily-goal-reminder.sql', 'lot-8-app-auth.sql', 'lot-9-recurring-expenses.sql', 'lot-11-recurring-monthly.sql',
];

$dryRun = in_array('--dry-run', $argv, true);
$pdo = budgetDb();
$pdo->setAttribute(PDO::ATTR_EMULATE_PREPARES, true);

$exists = (bool) $pdo->query("SHOW TABLES LIKE 'schema_migrations'")->fetchColumn();
if (!$exists && !$dryRun) {
    $pdo->exec('CREATE TABLE schema_migrations (
        filename varchar(190) NOT NULL PRIMARY KEY,
        applied_at timestamp NOT NULL DEFAULT current_timestamp()
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
    $mark = $pdo->prepare('INSERT IGNORE INTO schema_migrations(filename) VALUES(?)');
    foreach (BUDGET_HISTORICAL_MIGRATIONS as $file) $mark->execute([$file]);
    echo "Suivi des migrations créé ; " . count(BUDGET_HISTORICAL_MIGRATIONS) . " migrations historiques marquées comme appliquées.\n";
}

$applied = $exists || !$dryRun
    ? $pdo->query('SELECT filename FROM schema_migrations')->fetchAll(PDO::FETCH_COLUMN)
    : BUDGET_HISTORICAL_MIGRATIONS;
$files = array_map('basename', glob(dirname(__DIR__) . '/database/lot-*.sql') ?: []);
natsort($files);
$pending = array_values(array_diff($files, $applied));

if (!$pending) {
    echo "Aucune migration en attente.\n";
    exit(0);
}
foreach ($pending as $file) {
    if ($dryRun) { echo "À appliquer : $file\n"; continue; }
    $sql = (string) file_get_contents(dirname(__DIR__) . '/database/' . $file);
    try {
        $pdo->exec($sql);
        $pdo->prepare('INSERT INTO schema_migrations(filename) VALUES(?)')->execute([$file]);
        echo "Appliquée : $file\n";
    } catch (Throwable $error) {
        fwrite(STDERR, "ÉCHEC sur $file : " . $error->getMessage() . "\nArrêt : les migrations suivantes ne sont pas appliquées.\n");
        exit(1);
    }
}
