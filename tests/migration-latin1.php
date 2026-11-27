<?php
declare(strict_types=1);

/*
 * La production garde `entries` en latin1 (constaté le 27 novembre 2026) alors que la base locale est en
 * utf8mb4. La migration du lot 14 doit passer dans les deux cas. Lancé par gradual-expenses.spec.js.
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

$root = dirname(__DIR__);
$config = require $root . '/config.php';
$database = 'budget_josh_latin1_test';
$options = [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_EMULATE_PREPARES => true];
$server = new PDO("mysql:host={$config['host']};charset=utf8mb4", $config['username'], $config['password'], $options);

foreach (['latin1 latin1_swedish_ci', 'utf8mb4 utf8mb4_unicode_ci'] as $variant) {
    [$charset, $collation] = explode(' ', $variant);
    $server->exec("DROP DATABASE IF EXISTS `$database`");
    $server->exec("CREATE DATABASE `$database` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    $pdo = new PDO("mysql:host={$config['host']};dbname=$database;charset=utf8mb4", $config['username'], $config['password'], $options);
    $pdo->exec("CREATE TABLE entries (id char(36) NOT NULL PRIMARY KEY, status varchar(10) NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=$charset COLLATE=$collation");
    $pdo->exec('CREATE TABLE recurring_expenses (id char(36) NOT NULL PRIMARY KEY, note varchar(300)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');

    // Deux passages : la migration doit pouvoir être rejouée.
    for ($run = 0; $run < 2; $run++) {
        $result = $pdo->query((string) file_get_contents($root . '/database/lot-14-gradual-expenses.sql'));
        do { } while ($result->nextRowset());
        $result->closeCursor();
    }

    $pdo->exec("INSERT INTO entries(id,status) VALUES('depense-1','planned')");
    $pdo->exec("INSERT INTO entry_consumptions(id,entry_id,amount,consumed_on) VALUES('passage-1','depense-1',500,'2026-11-27')");
    $joined = $pdo->query('SELECT COUNT(*) FROM entries e JOIN entry_consumptions c ON c.entry_id=e.id')->fetchColumn();
    $pdo->exec("DELETE FROM entries WHERE id='depense-1'");
    $left = $pdo->query('SELECT COUNT(*) FROM entry_consumptions')->fetchColumn();
    if ((int) $joined !== 1 || (int) $left !== 0) {
        fwrite(STDERR, "ÉCHEC en $charset : jointure $joined, passages restants $left\n");
        exit(1);
    }
    echo "OK $charset\n";
}
$server->exec("DROP DATABASE IF EXISTS `$database`");
