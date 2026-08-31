<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

const GOAL_ICONS = ['target', 'car', 'book', 'home', 'health', 'travel', 'business', 'money', 'faith', 'family'];

function goalFail(string $message, int $status = 422): never
{
    http_response_code($status);
    echo json_encode(['error' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

function goalBody(): array
{
    try {
        $data = json_decode(file_get_contents('php://input'), true, 512, JSON_THROW_ON_ERROR);
        return is_array($data) ? $data : [];
    } catch (Throwable) {
        goalFail('Données invalides.');
    }
}

function validGoalDate(string $date): bool
{
    $parsed = DateTimeImmutable::createFromFormat('!Y-m-d', $date);
    return $parsed !== false && $parsed->format('Y-m-d') === $date && $date >= '2026-07-01';
}

function goalText(array $data, string $key, int $max, ?string $fallback = null): ?string
{
    if (!array_key_exists($key, $data)) return $fallback;
    $value = trim((string) $data[$key]);
    if (mb_strlen($value) > $max) goalFail("Le champ « {$key} » est trop long.");
    return $value === '' ? null : $value;
}

function goalTrackPayload(array $data, ?array $current = null): array
{
    $title = trim((string) ($data['title'] ?? ($current['title'] ?? '')));
    if ($title === '' || mb_strlen($title) > 160) {
        goalFail('Le nom de l’objectif est obligatoire et limité à 160 caractères.');
    }

    $icon = trim((string) ($data['icon_key'] ?? ($current['icon_key'] ?? 'target')));
    if (!in_array($icon, GOAL_ICONS, true)) $icon = 'target';

    return [
        'title' => $title,
        'category' => goalText($data, 'category', 80, $current['category'] ?? null),
        'icon_key' => $icon,
        'motivation' => goalText($data, 'motivation', 300, $current['motivation'] ?? null),
        'success_definition' => goalText($data, 'success_definition', 300, $current['success_definition'] ?? null),
        'resources' => goalText($data, 'resources', 500, $current['resources'] ?? null),
        'obstacles' => goalText($data, 'obstacles', 500, $current['obstacles'] ?? null),
    ];
}

try {
    $config = require __DIR__ . '/config.php';
    $pdo = new PDO(
        "mysql:host={$config['host']};dbname={$config['database']};charset=utf8mb4",
        $config['username'],
        $config['password'],
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
    $action = (string) ($_GET['action'] ?? '');

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $tracks = $pdo->query(
            'SELECT id,title,category,icon_key,motivation,success_definition,resources,obstacles FROM goal_tracks ORDER BY created_at'
        )->fetchAll(PDO::FETCH_ASSOC);
        $tasks = $pdo->query(
            "SELECT id,track_id,goal_month,DATE_FORMAT(target_date,'%Y-%m-%d') target_date,title,status,DATEDIFF(target_date,CURDATE()) days_remaining FROM goal_tasks ORDER BY COALESCE(target_date,CONCAT(goal_month,'-28')),created_at"
        )->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode(compact('tracks', 'tasks'), JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') goalFail('Méthode non autorisée.', 405);
    $data = goalBody();

    if ($action === 'track') {
        $track = goalTrackPayload($data);
        $pdo->prepare(
            'INSERT INTO goal_tracks(id,title,category,icon_key,motivation,success_definition,resources,obstacles) VALUES(?,?,?,?,?,?,?,?)'
        )->execute([
            $data['id'] ?? '', $track['title'], $track['category'], $track['icon_key'],
            $track['motivation'], $track['success_definition'], $track['resources'], $track['obstacles'],
        ]);
    } elseif ($action === 'track_update') {
        $id = (string) ($data['id'] ?? '');
        $query = $pdo->prepare('SELECT title,category,icon_key,motivation,success_definition,resources,obstacles FROM goal_tracks WHERE id=?');
        $query->execute([$id]);
        $current = $query->fetch(PDO::FETCH_ASSOC);
        if (!$current) goalFail('Objectif introuvable.', 404);
        $track = goalTrackPayload($data, $current);
        $pdo->prepare(
            'UPDATE goal_tracks SET title=?,category=?,icon_key=?,motivation=?,success_definition=?,resources=?,obstacles=? WHERE id=?'
        )->execute([
            $track['title'], $track['category'], $track['icon_key'], $track['motivation'],
            $track['success_definition'], $track['resources'], $track['obstacles'], $id,
        ]);
    } elseif ($action === 'track_delete') {
        $query = $pdo->prepare('DELETE FROM goal_tracks WHERE id=?');
        $query->execute([(string) ($data['id'] ?? '')]);
        if (!$query->rowCount()) goalFail('Objectif introuvable.', 404);
    } elseif ($action === 'task' || $action === 'task_update') {
        $title = trim((string) ($data['title'] ?? ''));
        $target = (string) ($data['target_date'] ?? '');
        if ($title === '' || mb_strlen($title) > 200) goalFail('L’étape est obligatoire et limitée à 200 caractères.');
        if (!validGoalDate($target)) goalFail('Choisissez une date cible valide à partir de juillet 2026.');

        if ($action === 'task') {
            $trackId = (string) ($data['track_id'] ?? '');
            $check = $pdo->prepare('SELECT id FROM goal_tracks WHERE id=?');
            $check->execute([$trackId]);
            if (!$check->fetchColumn()) goalFail('Objectif global introuvable.', 404);
            $pdo->prepare(
                'INSERT INTO goal_tasks(id,track_id,goal_month,target_date,title) VALUES(?,?,?,?,?)'
            )->execute([(string) ($data['id'] ?? ''), $trackId, substr($target, 0, 7), $target, $title]);
        } else {
            $query = $pdo->prepare('UPDATE goal_tasks SET title=?,target_date=?,goal_month=? WHERE id=?');
            $query->execute([$title, $target, substr($target, 0, 7), (string) ($data['id'] ?? '')]);
            if (!$query->rowCount()) {
                $exists = $pdo->prepare('SELECT id FROM goal_tasks WHERE id=?');
                $exists->execute([(string) ($data['id'] ?? '')]);
                if (!$exists->fetchColumn()) goalFail('Étape introuvable.', 404);
            }
        }
    } elseif ($action === 'task_status') {
        $status = (string) ($data['status'] ?? '');
        if (!in_array($status, ['planned', 'realised'], true)) goalFail('Statut d’étape invalide.');
        $query = $pdo->prepare('UPDATE goal_tasks SET status=? WHERE id=?');
        $query->execute([$status, (string) ($data['id'] ?? '')]);
        if (!$query->rowCount()) {
            $exists = $pdo->prepare('SELECT id FROM goal_tasks WHERE id=?');
            $exists->execute([(string) ($data['id'] ?? '')]);
            if (!$exists->fetchColumn()) goalFail('Étape introuvable.', 404);
        }
    } elseif ($action === 'task_delete') {
        $query = $pdo->prepare('DELETE FROM goal_tasks WHERE id=?');
        $query->execute([(string) ($data['id'] ?? '')]);
        if (!$query->rowCount()) goalFail('Étape introuvable.', 404);
    } else {
        goalFail('Action inconnue.', 404);
    }

    echo json_encode(['ok' => true], JSON_UNESCAPED_UNICODE);
} catch (PDOException $error) {
    if ($error->getCode() === '23000') goalFail('Cet élément existe déjà ou est encore utilisé.');
    goalFail('Impossible de traiter la demande.', 500);
} catch (Throwable) {
    goalFail('Impossible de traiter la demande.', 500);
}
