<?php
declare(strict_types=1);

/*
 * API principale de l'écran Budgets.
 * GET  ?action=bootstrap        budgets, dépenses, paiements et totaux calculés par le serveur
 * POST ?action=budget           nouveau budget (Grâce, Projet ou Tontine) + premier paiement + dîme 10 % (jamais pour une Tontine)
 * POST ?action=payment          paiement supplémentaire + dîme 10 %
 * POST ?action=payment_update   correction d'un paiement ; la dîme liée suit (10 %)
 * POST ?action=payment_delete   suppression d'un paiement et de sa dîme (jamais le dernier)
 * POST ?action=expense          nouvelle dépense
 * POST ?action=expense_update   libellé et montant d'une dépense
 * POST ?action=budget_label     nom d'un Projet
 * POST ?action=budget_month     mois d'une Grâce
 */

require __DIR__ . '/auth.php';
require __DIR__ . '/recurring-service.php';
require __DIR__ . '/lib/budget-totals.php';
budgetRequireAuthApi();

$action = (string) ($_GET['action'] ?? '');
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    $pdo = budgetDb();

    if ($method === 'GET' && $action === 'bootstrap') {
        $budgets = $pdo->query(
            "SELECT b.id,b.kind,b.name,b.period_month,DATE_FORMAT(b.project_date,'%Y-%m-%d') project_date,
                    COALESCE(SUM(p.amount),0) received
             FROM budgets b LEFT JOIN budget_payments p ON p.budget_id=b.id
             GROUP BY b.id ORDER BY COALESCE(b.period_month,b.project_date) DESC,b.created_at DESC"
        )->fetchAll();
        $expenses = $pdo->query(
            "SELECT id,budget_id,payment_id,type,amount,label,note,bucket,nature,status,source,DATE_FORMAT(entry_date,'%Y-%m-%d') date
             FROM entries ORDER BY entry_date DESC,created_at DESC"
        )->fetchAll();
        $payments = $pdo->query(
            "SELECT id,budget_id,amount,label,DATE_FORMAT(payment_date,'%Y-%m-%d') date
             FROM budget_payments ORDER BY payment_date DESC,created_at DESC"
        )->fetchAll();
        budgetJson(['budgets' => $budgets, 'expenses' => $expenses, 'payments' => $payments, 'totals' => budgetTotals($pdo)]);
    }

    if ($method !== 'POST') budgetFail('Méthode non autorisée.', 405);
    $d = budgetBody();

    $budgetExists = static function (string $id, ?string $kind = null) use ($pdo): bool {
        $q = $pdo->prepare('SELECT 1 FROM budgets WHERE id=?' . ($kind ? ' AND kind=?' : ''));
        $q->execute($kind ? [$id, $kind] : [$id]);
        return (bool) $q->fetchColumn();
    };
    // Dîme de 10 % sur chaque paiement reçu, sauf pour une Tontine (épargne) : décision de Josh du 24 novembre 2026,
    // c'est le seul cas sans dîme et il n'y a pas d'option. La règle est appliquée ici, côté serveur.
    $addTithe = static function (string $budgetId, string $paymentId, float $amount, string $label, string $date) use ($pdo, $d): void {
        $kind = $pdo->prepare('SELECT kind FROM budgets WHERE id=?');
        $kind->execute([$budgetId]);
        if ($kind->fetchColumn() === 'tontine') return;
        $pdo->prepare(
            "INSERT INTO entries(id,budget_id,payment_id,type,amount,label,bucket,status,entry_date,source)
             VALUES(?,?,?,'expense',?,?,'tithe','planned',?,'budget')"
        )->execute([budgetId($d, 'tithe_id'), $budgetId, $paymentId, round($amount * .1), 'Dîme — ' . $label, $date]);
    };
    $paymentRow = static function (string $id) use ($pdo): array {
        $q = $pdo->prepare('SELECT id,budget_id,amount,label FROM budget_payments WHERE id=?');
        $q->execute([$id]);
        return $q->fetch() ?: budgetFail('Paiement introuvable.', 404);
    };

    switch ($action) {
        case 'budget': {
            $kind = (string) ($d['kind'] ?? '');
            if (!in_array($kind, ['grace', 'project', 'tontine'], true)) budgetFail('Type de budget invalide.');
            $id = budgetId($d);
            $month = $kind === 'grace' ? budgetMonth($d, 'period_month') : null;
            $projectDate = $kind !== 'grace' ? budgetDate($d, 'project_date') : null;
            if (($month ?? substr((string) $projectDate, 0, 7)) < BUDGET_FIRST_MONTH) budgetFail('Les budgets commencent en juin 2026.');
            $name = $kind === 'grace' ? 'Grâce ' . $month : budgetText($d, 'name', 160);
            $amount = budgetAmount($d);
            $paymentLabel = budgetText($d, 'payment_label', 180);
            $paymentDate = budgetDate($d, 'payment_date');

            $pdo->beginTransaction();
            $pdo->prepare('INSERT INTO budgets(id,kind,name,period_month,project_date) VALUES(?,?,?,?,?)')
                ->execute([$id, $kind, $name, $month, $projectDate]);
            $paymentId = budgetId($d, 'payment_id');
            $pdo->prepare('INSERT INTO budget_payments(id,budget_id,amount,label,payment_date) VALUES(?,?,?,?,?)')
                ->execute([$paymentId, $id, $amount, $paymentLabel, $paymentDate]);
            $addTithe($id, $paymentId, $amount, $paymentLabel, $paymentDate);
            $pdo->commit();
            $created = $kind === 'grace' ? budgetRecurringGenerate($pdo)['created'] : 0;
            budgetJson(['ok' => true, 'recurring_created' => $created]);
        }

        case 'payment': {
            $budgetId = budgetId($d, 'budget_id');
            if (!$budgetExists($budgetId)) budgetFail('Budget introuvable.', 404);
            $amount = budgetAmount($d);
            $label = budgetText($d, 'label', 180);
            $date = budgetDate($d, 'payment_date');
            $pdo->beginTransaction();
            $paymentId = budgetId($d);
            $pdo->prepare('INSERT INTO budget_payments(id,budget_id,amount,label,payment_date) VALUES(?,?,?,?,?)')
                ->execute([$paymentId, $budgetId, $amount, $label, $date]);
            $addTithe($budgetId, $paymentId, $amount, $label, $date);
            $pdo->commit();
            budgetJson(['ok' => true]);
        }

        case 'payment_update': {
            // Correction d'un paiement reçu. Décision de Josh (18 novembre 2026, option A) :
            // la dîme liée suit automatiquement (10 % du nouveau montant, même libellé et même date).
            $payment = $paymentRow(budgetId($d));
            $amount = budgetAmount($d);
            $label = budgetText($d, 'label', 180);
            $date = budgetDate($d, 'payment_date');
            $tithe = $pdo->prepare("SELECT id,amount,status FROM entries WHERE payment_id=? AND bucket='tithe' LIMIT 1");
            $tithe->execute([$payment['id']]);
            $linked = $tithe->fetch() ?: null;
            $pdo->beginTransaction();
            $pdo->prepare('UPDATE budget_payments SET amount=?,label=?,payment_date=? WHERE id=?')->execute([$amount, $label, $date, $payment['id']]);
            if ($linked) {
                $pdo->prepare('UPDATE entries SET amount=?,label=?,entry_date=? WHERE id=?')
                    ->execute([round($amount * .1), 'Dîme — ' . $label, $date, $linked['id']]);
            }
            $pdo->commit();
            budgetJson(['ok' => true, 'tithe' => $linked ? [
                'before' => (float) $linked['amount'], 'after' => round($amount * .1), 'status' => $linked['status'],
            ] : null]);
        }

        case 'payment_delete': {
            $payment = $paymentRow(budgetId($d));
            $count = $pdo->prepare('SELECT COUNT(*) FROM budget_payments WHERE budget_id=?');
            $count->execute([$payment['budget_id']]);
            if ((int) $count->fetchColumn() <= 1) budgetFail('Un budget garde au moins un paiement. Pour tout effacer, supprime le budget.');
            $pdo->beginTransaction();
            $pdo->prepare("DELETE FROM entries WHERE payment_id=? AND bucket='tithe'")->execute([$payment['id']]);
            $pdo->prepare('DELETE FROM budget_payments WHERE id=?')->execute([$payment['id']]);
            $pdo->commit();
            budgetJson(['ok' => true]);
        }

        case 'expense': {
            $budgetId = budgetId($d, 'budget_id');
            if (!$budgetExists($budgetId)) budgetFail('Budget introuvable.', 404);
            if (!in_array($d['status'] ?? '', ['planned', 'realised'], true)) budgetFail('Statut invalide.');
            if (!in_array($d['bucket'] ?? '', ['priority', 'dogs'], true)) budgetFail('Choisissez Priorités ou Petits chiens.');
            $date = budgetDate($d, 'date');
            if (substr($date, 0, 7) < BUDGET_FIRST_MONTH) budgetFail('Les dépenses commencent en juin 2026.');
            $pdo->prepare(
                "INSERT INTO entries(id,budget_id,type,amount,label,note,bucket,nature,status,entry_date,source)
                 VALUES(?,?,'expense',?,?,?,?,?,?,?,'budget')"
            )->execute([
                budgetId($d), $budgetId, budgetAmount($d), budgetText($d, 'label', 180),
                budgetText($d, 'note', 300, false), $d['bucket'], budgetText($d, 'nature', 40, false), $d['status'], $date,
            ]);
            budgetJson(['ok' => true]);
        }

        case 'expense_update': {
            $id = budgetId($d);
            $label = budgetText($d, 'label', 180);
            $amount = budgetAmount($d);
            $exists = $pdo->prepare("SELECT 1 FROM entries WHERE id=? AND bucket IN ('priority','dogs','tithe')");
            $exists->execute([$id]);
            if (!$exists->fetchColumn()) budgetFail('Dépense introuvable.', 404);
            $pdo->prepare("UPDATE entries SET label=?,amount=? WHERE id=?")->execute([$label, $amount, $id]);
            budgetJson(['ok' => true]);
        }

        case 'budget_label': {
            $id = budgetId($d);
            $name = budgetText($d, 'name', 160);
            if (!$budgetExists($id, 'project') && !$budgetExists($id, 'tontine')) budgetFail('Budget introuvable.', 404);
            $pdo->prepare("UPDATE budgets SET name=? WHERE id=? AND kind IN ('project','tontine')")->execute([$name, $id]);
            budgetJson(['ok' => true]);
        }

        case 'budget_month': {
            $id = budgetId($d);
            $month = budgetMonth($d, 'month');
            if ($month < BUDGET_FIRST_MONTH) budgetFail('Le mois doit être à partir de juin 2026.');
            if (!$budgetExists($id, 'grace')) budgetFail('Budget introuvable.', 404);
            $pdo->prepare("UPDATE budgets SET period_month=?,name=? WHERE id=? AND kind='grace'")->execute([$month, 'Grâce ' . $month, $id]);
            budgetRecurringGenerate($pdo);
            budgetJson(['ok' => true]);
        }
    }
    budgetFail('Action inconnue.', 404);
} catch (Throwable $error) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    error_log('api.php : ' . $error->getMessage());
    budgetFail('Impossible d’enregistrer. Vérifiez la base de données.', 500);
}
