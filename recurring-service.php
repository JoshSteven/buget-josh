<?php
declare(strict_types=1);

/*
 * Génération des dépenses récurrentes (lot 11).
 *
 * Règle : chaque occurrence mensuelle va dans le budget Grâce du mois de l'occurrence.
 * Si cette Grâce n'existe pas encore, la récurrence attend : elle sera générée dès que
 * la Grâce du mois est créée (appel depuis api.php) ou au passage du Cron quotidien.
 * Les budgets Projet ne reçoivent jamais de récurrence.
 *
 * Appelé par cron-recurring-expenses.php, api.php (création d'une Grâce) et
 * recurring-api.php (création d'une récurrence). Ne produit aucune sortie.
 */

function budgetRecurringNextDate(DateTimeImmutable $date, int $day): DateTimeImmutable
{
    $month = $date->modify('first day of next month');
    $safeDay = min($day, (int) $month->format('t'));
    return $month->setDate((int) $month->format('Y'), (int) $month->format('m'), $safeDay);
}

/** @return array{models:int,occurrences:int,created:int,waiting:int} */
function budgetRecurringGenerate(PDO $pdo, bool $dryRun = false): array
{
    $models = $pdo->query(
        'SELECT id,label,amount,bucket,nature,note,day_of_month,next_date
         FROM recurring_expenses WHERE active=1 ORDER BY next_date'
    )->fetchAll(PDO::FETCH_ASSOC);
    $graceFor = $pdo->prepare(
        "SELECT id FROM budgets WHERE kind='grace' AND period_month=? ORDER BY created_at LIMIT 1"
    );
    $stats = ['models' => count($models), 'occurrences' => 0, 'created' => 0, 'waiting' => 0];

    foreach ($models as $model) {
        $date = new DateTimeImmutable($model['next_date']);
        // Garde-fou : jamais plus de 24 mois d'un coup.
        for ($guard = 0; $guard < 24; $guard++) {
            $graceFor->execute([$date->format('Y-m')]);
            $budgetId = $graceFor->fetchColumn();
            if (!$budgetId) {
                $stats['waiting']++;
                break;
            }
            $stats['occurrences']++;
            if (!$dryRun) {
                $pdo->beginTransaction();
                try {
                    $entryId = bin2hex(random_bytes(16));
                    $pdo->prepare('INSERT INTO recurring_expense_runs(recurring_id,occurrence_date,entry_id) VALUES(?,?,?)')
                        ->execute([$model['id'], $date->format('Y-m-d'), $entryId]);
                    $pdo->prepare(
                        "INSERT INTO entries(id,budget_id,type,amount,label,note,bucket,nature,status,entry_date,source)
                         VALUES(?,?, 'expense',?,?,?,?,?,'planned',?,'recurring')"
                    )->execute([
                        $entryId, $budgetId, $model['amount'], $model['label'], $model['note'],
                        $model['bucket'], $model['nature'], $date->format('Y-m-d'),
                    ]);
                    $pdo->commit();
                    $stats['created']++;
                } catch (Throwable $error) {
                    if ($pdo->inTransaction()) $pdo->rollBack();
                    // Occurrence déjà générée (clé unique) : on passe simplement au mois suivant.
                    if (!str_contains($error->getMessage(), 'Duplicate entry')) throw $error;
                }
            }
            $date = budgetRecurringNextDate($date, (int) $model['day_of_month']);
        }
        if (!$dryRun && $date->format('Y-m-d') !== $model['next_date']) {
            $pdo->prepare('UPDATE recurring_expenses SET next_date=? WHERE id=?')
                ->execute([$date->format('Y-m-d'), $model['id']]);
        }
    }
    return $stats;
}
