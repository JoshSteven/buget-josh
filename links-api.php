<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
require __DIR__ . '/auth.php';
budgetRequireAuthApi();

function linksFail(string $message, int $status = 422): never
{
    http_response_code($status);
    echo json_encode(['error' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    $config = require __DIR__ . '/config.php';
    $pdo = new PDO("mysql:host={$config['host']};dbname={$config['database']};charset=utf8mb4", $config['username'], $config['password'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $expenses = $pdo->query("SELECT e.id,e.budget_id,e.label,e.amount,e.bucket,e.status,e.goal_task_id,b.name AS budget_name FROM entries e JOIN budgets b ON b.id=e.budget_id WHERE e.type='expense' AND e.status<>'cancelled' ORDER BY e.entry_date DESC,e.created_at DESC")->fetchAll(PDO::FETCH_ASSOC);
        $tasks = $pdo->query("SELECT t.id,t.track_id,t.goal_month,DATE_FORMAT(t.target_date,'%Y-%m-%d') target_date,t.title,g.title AS track_title FROM goal_tasks t JOIN goal_tracks g ON g.id=t.track_id ORDER BY t.goal_month,t.created_at")->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode(compact('expenses', 'tasks'), JSON_UNESCAPED_UNICODE);
        exit;
    }
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') linksFail('Méthode non autorisée.',405);
    try {$data = json_decode(file_get_contents('php://input'), true, 512, JSON_THROW_ON_ERROR);} catch(Throwable){linksFail('Données invalides.');}
    $entryId = (string) ($data['entry_id'] ?? '');
    $taskId = $data['goal_task_id'] ?? null;
    if ($entryId === '') linksFail('Dépense introuvable.');
    if ($taskId !== null && $taskId !== '') {
        $check = $pdo->prepare('SELECT id FROM goal_tasks WHERE id=?');
        $check->execute([$taskId]);
        if (!$check->fetchColumn()) linksFail('Action d’objectif introuvable.');
        $taskId = (string) $taskId;
    } else {
        $taskId = null;
    }
    $entry=$pdo->prepare("SELECT id FROM entries WHERE id=? AND type='expense' AND status<>'cancelled'");$entry->execute([$entryId]);if(!$entry->fetchColumn())linksFail('Dépense introuvable.',404);
    $pdo->prepare('UPDATE entries SET goal_task_id=? WHERE id=?')->execute([$taskId, $entryId]);
    echo json_encode(['ok' => true], JSON_UNESCAPED_UNICODE);
} catch (Throwable $error) {
    linksFail('Impossible de traiter la liaison.', 500);
}
