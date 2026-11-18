<?php
declare(strict_types=1);

/*
 * Moteur de calcul unique (lot Fondations). Toutes les sommes affichées par l'écran
 * Budgets, le Tableau de bord et l'export Excel viennent d'ici.
 *
 * Règles :
 *  - les dépenses annulées sont exclues de tous les totaux ;
 *  - Priorités = bucket « priority » + dîme (« tithe ») ; Petits chiens = « dogs » ;
 *  - disponible réel = reçu − réalisé ; disponible engagé = reçu − réalisé − prévu.
 */

/** @return array<string, array> totaux indexés par identifiant de budget */
function budgetTotals(PDO $pdo): array
{
    $totals = [];
    $budgets = $pdo->query(
        'SELECT b.id, COALESCE(SUM(p.amount),0) received FROM budgets b
         LEFT JOIN budget_payments p ON p.budget_id=b.id GROUP BY b.id'
    )->fetchAll(PDO::FETCH_ASSOC);
    foreach ($budgets as $b) {
        $totals[$b['id']] = [
            'received' => (float) $b['received'],
            'realised' => 0.0,
            'planned' => 0.0,
            'priority' => ['realised' => 0.0, 'planned' => 0.0],
            'dogs' => ['realised' => 0.0, 'planned' => 0.0],
            'natures' => [],
        ];
    }

    $rows = $pdo->query(
        "SELECT budget_id, bucket, status, COALESCE(NULLIF(nature,''),'') nature, SUM(amount) total
         FROM entries WHERE type='expense' AND status IN ('planned','realised')
         GROUP BY budget_id, bucket, status, nature"
    )->fetchAll(PDO::FETCH_ASSOC);
    foreach ($rows as $r) {
        if (!isset($totals[$r['budget_id']])) continue;
        $t = &$totals[$r['budget_id']];
        $amount = (float) $r['total'];
        $status = $r['status'];
        $category = $r['bucket'] === 'dogs' ? 'dogs' : 'priority';
        $t[$status] += $amount;
        $t[$category][$status] += $amount;
        if ($r['nature'] !== '') {
            $t['natures'][$r['nature']] ??= ['realised' => 0.0, 'planned' => 0.0];
            $t['natures'][$r['nature']][$status] += $amount;
        }
        unset($t);
    }

    foreach ($totals as &$t) {
        foreach (['realised', 'planned'] as $k) $t[$k] = round($t[$k], 2);
        $t['committed'] = round($t['realised'] + $t['planned'], 2);
        $t['available_real'] = round($t['received'] - $t['realised'], 2);
        $t['available_committed'] = round($t['received'] - $t['realised'] - $t['planned'], 2);
        uasort($t['natures'], static fn($x, $y) => ($y['realised'] + $y['planned']) <=> ($x['realised'] + $x['planned']));
    }
    unset($t);
    return $totals;
}
