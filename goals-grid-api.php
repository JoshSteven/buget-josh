<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');

try {
    $config = require __DIR__ . '/config.php';
    $pdo = new PDO("mysql:host={$config['host']};dbname={$config['database']};charset=utf8mb4", $config['username'], $config['password'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $action = $_GET['action'] ?? '';
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $tracks = $pdo->query('SELECT id,title FROM goal_tracks ORDER BY created_at')->fetchAll(PDO::FETCH_ASSOC);
        $tasks = $pdo->query('SELECT id,track_id,goal_month,title,status FROM goal_tasks ORDER BY goal_month,created_at')->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode(compact('tracks', 'tasks'), JSON_UNESCAPED_UNICODE);
        exit;
    }
    $data = json_decode(file_get_contents('php://input'), true, 512, JSON_THROW_ON_ERROR);
    if ($action === 'track') {
        $title = trim((string) ($data['title'] ?? ''));
        if ($title === '') throw new RuntimeException('Le titre est obligatoire.');
        $pdo->prepare('INSERT INTO goal_tracks(id,title) VALUES(?,?)')->execute([$data['id'], $title]);
    } elseif ($action === 'task') {
        $title = trim((string) ($data['title'] ?? ''));
        if ($title === '') throw new RuntimeException('L’action est obligatoire.');
        $pdo->prepare('INSERT INTO goal_tasks(id,track_id,goal_month,title) VALUES(?,?,?,?)')->execute([$data['id'], $data['track_id'], $data['goal_month'], $title]);
    } elseif ($action === 'toggle') {
        $pdo->prepare("UPDATE goal_tasks SET status=IF(status='planned','realised','planned') WHERE id=?")->execute([$data['id']]);
    } elseif ($action === 'track_update') {
        $title = trim((string) ($data['title'] ?? ''));
        if ($title === '') throw new RuntimeException('Le titre est obligatoire.');
        $pdo->prepare('UPDATE goal_tracks SET title=? WHERE id=?')->execute([$title, $data['id']]);
    } elseif ($action === 'track_delete') {
        $pdo->prepare('DELETE FROM goal_tracks WHERE id=?')->execute([$data['id']]);
    } else {
        throw new RuntimeException('Action inconnue.');
    }
    echo json_encode(['ok' => true], JSON_UNESCAPED_UNICODE);
} catch (Throwable $error) {
    http_response_code(422);
    echo json_encode(['error' => $error->getMessage()], JSON_UNESCAPED_UNICODE);
}
