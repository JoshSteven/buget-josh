<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once __DIR__ . '/goal-reminder-service.php';
$config = require __DIR__ . '/config.php';
$notificationConfig = is_file(__DIR__ . '/notification-secrets.php') ? require __DIR__ . '/notification-secrets.php' : [];
$pdo = new PDO(
    "mysql:host={$config['host']};dbname={$config['database']};charset=utf8mb4",
    $config['username'],
    $config['password'],
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
);

$created = materializeGoalReminders($pdo);
$dryRun = in_array('--dry-run', $argv, true);
$pending = $pdo->query(
    "SELECT r.id,r.task_id,r.reminder_type,t.title task_title,t.target_date,g.title track_title,DATEDIFF(t.target_date,CURDATE()) days_remaining FROM goal_reminders r JOIN goal_tasks t ON t.id=r.task_id JOIN goal_tracks g ON g.id=t.track_id WHERE r.push_sent_at IS NULL AND r.due_date<=CURDATE()"
)->fetchAll(PDO::FETCH_ASSOC);

if ($dryRun) {
    echo json_encode(['created' => $created, 'pending' => count($pending), 'dry_run' => true], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . PHP_EOL;
    exit;
}

$public = (string) (getenv('BUDGET_JOSH_VAPID_PUBLIC_KEY') ?: ($notificationConfig['vapid_public_key'] ?? ($config['vapid_public_key'] ?? '')));
$private = (string) (getenv('BUDGET_JOSH_VAPID_PRIVATE_KEY') ?: ($notificationConfig['vapid_private_key'] ?? ($config['vapid_private_key'] ?? '')));
$subject = (string) (getenv('BUDGET_JOSH_VAPID_SUBJECT') ?: ($notificationConfig['vapid_subject'] ?? ($config['vapid_subject'] ?? 'mailto:admin@example.com')));
if ($public === '' || $private === '') {
    fwrite(STDERR, "Clés VAPID absentes.\n");
    exit(2);
}

require __DIR__ . '/vendor/autoload.php';
$subscriptions = $pdo->query('SELECT endpoint,p256dh,auth_token,content_encoding FROM push_subscriptions')->fetchAll(PDO::FETCH_ASSOC);
$webPush = new Minishlink\WebPush\WebPush(['VAPID' => ['subject' => $subject, 'publicKey' => $public, 'privateKey' => $private]]);
$sentIds = [];

foreach ($pending as $reminder) {
    $message = goalReminderMessage($reminder['reminder_type'], $reminder['task_title'], $reminder['track_title'], max(0, (int) $reminder['days_remaining']));
    $payload = json_encode($message + ['url' => 'objectives.php#task-' . $reminder['task_id'], 'tag' => 'goal-' . $reminder['id']], JSON_UNESCAPED_UNICODE);
    $delivered = false;

    foreach ($subscriptions as $subscriptionData) {
        $subscription = Minishlink\WebPush\Subscription::create([
            'endpoint' => $subscriptionData['endpoint'],
            'publicKey' => $subscriptionData['p256dh'],
            'authToken' => $subscriptionData['auth_token'],
            'contentEncoding' => $subscriptionData['content_encoding'],
        ]);
        $report = $webPush->sendOneNotification($subscription, $payload);
        if ($report->isSuccess()) {
            $delivered = true;
        } else {
            fwrite(STDERR, 'Push échoué: ' . $report->getReason() . PHP_EOL);
            if ($report->isSubscriptionExpired()) {
                $pdo->prepare('DELETE FROM push_subscriptions WHERE endpoint_hash=?')->execute([hash('sha256', $report->getEndpoint())]);
            }
        }
    }

    if ($delivered) $sentIds[] = $reminder['id'];
}

if ($sentIds) {
    $marks = implode(',', array_fill(0, count($sentIds), '?'));
    $query = $pdo->prepare("UPDATE goal_reminders SET push_sent_at=NOW() WHERE id IN ($marks)");
    $query->execute($sentIds);
}

echo json_encode([
    'created' => $created,
    'pending' => count($pending),
    'subscriptions' => count($subscriptions),
    'sent' => count($sentIds),
], JSON_UNESCAPED_UNICODE) . PHP_EOL;
