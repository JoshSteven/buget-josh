<?php
declare(strict_types=1);

/*
 * Recrée la base de test à partir de zéro : structure (database/schema.sql),
 * données fictives (tests/fixtures.sql) et mot de passe de test.
 * Appelé par tests/global-setup.js avant chaque lancement de la suite.
 * Refuse de toucher une base dont le nom ne finit pas par _test.
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

$root = dirname(__DIR__);
$database = (string) (getenv('BUDGET_JOSH_DB') ?: 'budget_josh_test');
if (!str_ends_with($database, '_test')) {
    fwrite(STDERR, "Refus : la base de test doit finir par _test ($database).\n");
    exit(2);
}
$password = (string) (getenv('BUDGET_JOSH_TEST_PASSWORD') ?: 'test-local-jetable-2026');
$config = require $root . '/config.php';

$server = new PDO("mysql:host={$config['host']};charset=utf8mb4", $config['username'], $config['password'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$server->exec("DROP DATABASE IF EXISTS `$database`");
$server->exec("CREATE DATABASE `$database` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");

$pdo = new PDO("mysql:host={$config['host']};dbname=$database;charset=utf8mb4", $config['username'], $config['password'], [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_EMULATE_PREPARES => true,
]);
$pdo->exec((string) file_get_contents($root . '/database/schema.sql'));
$pdo->exec((string) file_get_contents(__DIR__ . '/fixtures.sql'));
$pdo->prepare('INSERT INTO app_credentials(id,password_hash) VALUES(1,?)')->execute([password_hash($password, PASSWORD_DEFAULT)]);

echo "Base $database prête.\n";
