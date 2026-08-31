<?php
declare(strict_types=1);

function goalUuid(): string
{
    $bytes = random_bytes(16);
    $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
    $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
}

function goalReminderType(int $daysRemaining, DateTimeImmutable $today): ?string
{
    if ($daysRemaining === 7) return 'j7';
    if ($daysRemaining === 1) return 'j1';
    if ($daysRemaining > 7 && (int) $today->format('N') === 1) return 'weekly';
    return null;
}

function materializeGoalReminders(PDO $pdo, ?DateTimeImmutable $date = null): int
{
    $today = $date ?? new DateTimeImmutable('today', new DateTimeZone('Africa/Ouagadougou'));
    $query = $pdo->prepare("SELECT id,target_date FROM goal_tasks WHERE target_date IS NOT NULL AND status<>'realised' AND target_date>=? ORDER BY target_date ASC");
    $query->execute([$today->format('Y-m-d')]);
    $tasks = $query->fetchAll(PDO::FETCH_ASSOC);
    $insert = $pdo->prepare('INSERT IGNORE INTO goal_reminders(id,task_id,reminder_type,due_date) VALUES(?,?,?,?)');
    $created = 0;
    foreach ($tasks as $task) {
        $target = new DateTimeImmutable((string) $task['target_date'], $today->getTimezone());
        $days = (int) $today->diff($target)->format('%a');
        $type = goalReminderType($days, $today);
        if ($type === null) continue;
        $insert->execute([goalUuid(), $task['id'], $type, $today->format('Y-m-d')]);
        $created += $insert->rowCount();
    }

    // Rappel quotidien : une seule notification par jour, toujours pointée sur
    // l'action à échéance la plus proche (liste déjà triée par target_date ASC).
    // S'il n'y a aucune action à venir, on n'envoie rien plutôt qu'un message vide.
    if ($tasks) {
        $insert->execute([goalUuid(), $tasks[0]['id'], 'daily', $today->format('Y-m-d')]);
        $created += $insert->rowCount();
    }

    return $created;
}

function goalReminderMessage(string $type, string $taskTitle, string $trackTitle, int $days): array
{
    $title = match ($type) {
        'j7' => 'Plus que 7 jours',
        'j1' => 'Échéance demain',
        default => 'Point sur vos objectifs',
    };
    $body = in_array($type, ['weekly', 'daily'], true)
        ? "Où en êtes-vous avec « {$taskTitle} » dans {$trackTitle} ?"
        : "« {$taskTitle} » — {$days} jour" . ($days > 1 ? 's' : '') . ' restant' . ($days > 1 ? 's' : '') . '.';
    return compact('title', 'body');
}
