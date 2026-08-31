<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/goal-reminder-service.php';

function notificationFail(string $message, int $status = 422): never
{
    http_response_code($status);
    echo json_encode(['error' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

function notificationBody(): array
{
    try {
        $data = json_decode(file_get_contents('php://input'), true, 512, JSON_THROW_ON_ERROR);
        return is_array($data) ? $data : [];
    } catch (Throwable) {
        notificationFail('Données invalides.');
    }
}

function vapidSettings(array $config, array $notificationConfig): array
{
    return [
        'publicKey' => (string) (getenv('BUDGET_JOSH_VAPID_PUBLIC_KEY') ?: ($notificationConfig['vapid_public_key'] ?? ($config['vapid_public_key'] ?? ''))),
        'privateKey' => (string) (getenv('BUDGET_JOSH_VAPID_PRIVATE_KEY') ?: ($notificationConfig['vapid_private_key'] ?? ($config['vapid_private_key'] ?? ''))),
        'subject' => (string) (getenv('BUDGET_JOSH_VAPID_SUBJECT') ?: ($notificationConfig['vapid_subject'] ?? ($config['vapid_subject'] ?? 'mailto:admin@example.com'))),
    ];
}

try {
    $config = require __DIR__ . '/config.php';
    $notificationConfig = is_file(__DIR__ . '/notification-secrets.php') ? require __DIR__ . '/notification-secrets.php' : [];
    $pdo = new PDO(
        "mysql:host={$config['host']};dbname={$config['database']};charset=utf8mb4",
        $config['username'],
        $config['password'],
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
    $action = (string) ($_GET['action'] ?? 'reminders');

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        if ($action === 'config') {
            $vapid = vapidSettings($config, $notificationConfig);
            echo json_encode(['available' => $vapid['publicKey'] !== '' && $vapid['privateKey'] !== '', 'publicKey' => $vapid['publicKey']], JSON_UNESCAPED_UNICODE);
            exit;
        }
        materializeGoalReminders($pdo);
        $rows = $pdo->query(
            "SELECT r.id,r.reminder_type,r.due_date,r.read_at,t.id task_id,t.title task_title,t.target_date,g.id track_id,g.title track_title,DATEDIFF(t.target_date,CURDATE()) days_remaining FROM goal_reminders r JOIN goal_tasks t ON t.id=r.task_id JOIN goal_tracks g ON g.id=t.track_id ORDER BY (r.read_at IS NULL) DESC,r.due_date DESC,r.created_at DESC LIMIT 50"
        )->fetchAll(PDO::FETCH_ASSOC);
        foreach ($rows as &$row) {
            $message = goalReminderMessage($row['reminder_type'], $row['task_title'], $row['track_title'], max(0, (int) $row['days_remaining']));
            $row += $message;
        }
        unset($row);
        echo json_encode(['reminders' => $rows, 'unread' => count(array_filter($rows, fn($row) => $row['read_at'] === null))], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') notificationFail('Méthode non autorisée.', 405);
    $data = notificationBody();

    if ($action === 'read') {
        $id = (string) ($data['id'] ?? '');
        if ($id === '') notificationFail('Rappel introuvable.');
        $query = $pdo->prepare('UPDATE goal_reminders SET read_at=COALESCE(read_at,NOW()) WHERE id=?');
        $query->execute([$id]);
        if (!$query->rowCount()) notificationFail('Rappel introuvable.', 404);
    } elseif ($action === 'subscribe') {
        $endpoint = (string) ($data['endpoint'] ?? '');
        $keys = $data['keys'] ?? [];
        $p256dh = (string) ($keys['p256dh'] ?? '');
        $auth = (string) ($keys['auth'] ?? '');
        if ($endpoint === '' || strlen($endpoint) > 2048 || parse_url($endpoint, PHP_URL_SCHEME) !== 'https' || $p256dh === '' || $auth === '') {
            notificationFail('Abonnement push invalide.');
        }
        $query = $pdo->prepare(
            'INSERT INTO push_subscriptions(id,endpoint_hash,endpoint,p256dh,auth_token,content_encoding) VALUES(?,?,?,?,?,?) ON DUPLICATE KEY UPDATE endpoint=VALUES(endpoint),p256dh=VALUES(p256dh),auth_token=VALUES(auth_token),content_encoding=VALUES(content_encoding),updated_at=NOW()'
        );
        $query->execute([goalUuid(), hash('sha256', $endpoint), $endpoint, $p256dh, $auth, (string) ($data['contentEncoding'] ?? 'aes128gcm')]);
    } elseif ($action === 'test') {
        $endpoint = (string) ($data['endpoint'] ?? '');
        if ($endpoint === '' || parse_url($endpoint, PHP_URL_SCHEME) !== 'https') notificationFail('Abonnement push invalide.');
        $query = $pdo->prepare('SELECT endpoint,p256dh,auth_token,content_encoding FROM push_subscriptions WHERE endpoint_hash=?');
        $query->execute([hash('sha256', $endpoint)]);
        $subscriptionData = $query->fetch(PDO::FETCH_ASSOC);
        if (!$subscriptionData) notificationFail('Cet appareil n’est pas encore enregistré. Activez d’abord les notifications.', 404);

        $vapid = vapidSettings($config, $notificationConfig);
        if ($vapid['publicKey'] === '' || $vapid['privateKey'] === '') notificationFail('Les clés Web Push ne sont pas configurées.', 503);
        require_once __DIR__ . '/vendor/autoload.php';
        $subscription = Minishlink\WebPush\Subscription::create([
            'endpoint' => $subscriptionData['endpoint'],
            'publicKey' => $subscriptionData['p256dh'],
            'authToken' => $subscriptionData['auth_token'],
            'contentEncoding' => $subscriptionData['content_encoding'],
        ]);
        $webPush = new Minishlink\WebPush\WebPush(['VAPID' => $vapid]);
        $payload = json_encode([
            'title' => 'Test Budget Josh',
            'body' => 'Le circuit Web Push fonctionne sur cet appareil.',
            'url' => 'objectives.php',
            'tag' => 'budget-josh-push-test',
        ], JSON_UNESCAPED_UNICODE);
        $report = $webPush->sendOneNotification($subscription, $payload);
        if (!$report->isSuccess()) {
            if ($report->isSubscriptionExpired()) {
                $pdo->prepare('DELETE FROM push_subscriptions WHERE endpoint_hash=?')->execute([hash('sha256', $endpoint)]);
                notificationFail('L’abonnement de cet appareil a expiré. Réactivez les notifications.', 410);
            }
            notificationFail('Le service Push a refusé le test. Réessayez dans quelques instants.', 502);
        }
    } elseif ($action === 'unsubscribe') {
        $endpoint = (string) ($data['endpoint'] ?? '');
        if ($endpoint === '') notificationFail('Abonnement introuvable.');
        $pdo->prepare('DELETE FROM push_subscriptions WHERE endpoint_hash=?')->execute([hash('sha256', $endpoint)]);
    } else {
        notificationFail('Action inconnue.', 404);
    }

    echo json_encode(['ok' => true], JSON_UNESCAPED_UNICODE);
} catch (Throwable) {
    notificationFail('Impossible de gérer les notifications.', 500);
}
