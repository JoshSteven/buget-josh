<?php
declare(strict_types=1);

/*
 * Sauvegarde compressée de la base (lot Fondations).
 *
 *   php bin/backup-database.php                 sauvegarde « nightly » (Cron de chaque nuit)
 *   php bin/backup-database.php --label=deploy  sauvegarde avant un déploiement
 *
 * Dossier : variable BUDGET_JOSH_BACKUP_DIR, sinon ~/backups/budget-josh (hors du site web).
 * Conservation : les 14 dernières de chaque type. Le mot de passe MySQL passe par un
 * fichier temporaire lisible par le seul propriétaire, jamais par la ligne de commande.
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require dirname(__DIR__) . '/lib/bootstrap.php';

$label = 'nightly';
foreach ($argv as $arg) {
    if (str_starts_with($arg, '--label=')) $label = preg_replace('/[^a-z0-9-]/', '', strtolower(substr($arg, 8))) ?: 'nightly';
}
$home = getenv('HOME') ?: (getenv('USERPROFILE') ?: dirname(__DIR__, 2));
$dir = getenv('BUDGET_JOSH_BACKUP_DIR') ?: $home . '/backups/budget-josh';
if (!is_dir($dir) && !mkdir($dir, 0700, true)) {
    fwrite(STDERR, "Impossible de créer le dossier de sauvegarde $dir\n");
    exit(2);
}

$c = budgetConfig();
$defaults = tempnam(sys_get_temp_dir(), 'bjdump');
chmod($defaults, 0600);
file_put_contents($defaults, "[client]\nuser=\"{$c['username']}\"\npassword=\"{$c['password']}\"\nhost=\"{$c['host']}\"\n");

$binary = getenv('BUDGET_JOSH_MYSQLDUMP') ?: 'mysqldump';
$file = sprintf('%s/budget-josh-%s-%s.sql.gz', $dir, $label, date('Ymd-His'));
$command = escapeshellarg($binary) . ' --defaults-extra-file=' . escapeshellarg($defaults)
    . ' --single-transaction --routines --no-tablespaces --default-character-set=utf8mb4 ' . escapeshellarg($c['database']);

$process = proc_open($command, [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
$dump = is_resource($process) ? stream_get_contents($pipes[1]) : '';
$errors = is_resource($process) ? stream_get_contents($pipes[2]) : 'mysqldump introuvable';
$status = is_resource($process) ? proc_close($process) : 1;
unlink($defaults);

if ($status !== 0 || !str_contains((string) $dump, 'CREATE TABLE')) {
    fwrite(STDERR, "Sauvegarde ÉCHOUÉE : " . trim((string) $errors) . "\n");
    exit(1);
}
file_put_contents($file, gzencode($dump, 9));
chmod($file, 0600);

// Rotation : on garde les 14 plus récentes de ce type.
$same = glob("$dir/budget-josh-$label-*.sql.gz") ?: [];
rsort($same);
foreach (array_slice($same, 14) as $old) unlink($old);

printf("Sauvegarde OK : %s (%s Ko)\n", basename($file), number_format(filesize($file) / 1024, 1, ',', ' '));
