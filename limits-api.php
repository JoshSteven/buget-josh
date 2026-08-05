<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');

function limitsFail(string $message, int $status = 422): never
{
    http_response_code($status);
    echo json_encode(['error' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

function limitsBody(): array
{
    try {
        return json_decode(file_get_contents('php://input'), true, 512, JSON_THROW_ON_ERROR);
    } catch (Throwable) {
        limitsFail('Données invalides.');
    }
}

try {
    $config = require __DIR__ . '/config.php';
    $pdo = new PDO("mysql:host={$config['host']};dbname={$config['database']};charset=utf8mb4", $config['username'], $config['password'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $pdo->exec("CREATE TABLE IF NOT EXISTS budget_limits (
        bucket ENUM('priority','dogs') NOT NULL PRIMARY KEY,
        mode ENUM('fixed','percent') NOT NULL DEFAULT 'fixed',
        limit_value DECIMAL(12,2) NOT NULL DEFAULT 0,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $limits = [];
        foreach ($pdo->query('SELECT bucket, mode, limit_value AS value FROM budget_limits')->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $limits[$row['bucket']] = ['mode' => $row['mode'], 'value' => (float) $row['value']];
        }
        echo json_encode(['limits' => $limits], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $body = limitsBody();
    foreach (['priority', 'dogs'] as $bucket) {
        $entry = $body[$bucket] ?? [];
        $mode = (string) ($entry['mode'] ?? 'fixed');
        $value = (float) ($entry['value'] ?? 0);
        if (!in_array($mode, ['fixed', 'percent'], true) || $value < 0 || ($mode === 'percent' && $value > 100)) {
            limitsFail('Chaque plafond doit être un montant positif ou un pourcentage entre 0 et 100.');
        }
        $pdo->prepare("INSERT INTO budget_limits(bucket, mode, limit_value) VALUES(?,?,?) ON DUPLICATE KEY UPDATE mode=VALUES(mode), limit_value=VALUES(limit_value)")->execute([$bucket, $mode, $value]);
    }
    echo json_encode(['ok' => true], JSON_UNESCAPED_UNICODE);
} catch (Throwable) {
    limitsFail('Impossible de charger ou d’enregistrer les plafonds.', 500);
}
