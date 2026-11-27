<?php
declare(strict_types=1);

/*
 * Moteur de calcul unique (lot Fondations). Toutes les sommes affichées par l'écran
 * Budgets, le Tableau de bord et l'export Excel viennent d'ici.
 *
 * Règles :
 *  - les dépenses annulées sont exclues de tous les totaux ;
 *  - Priorités = bucket « priority » + dîme (« tithe ») ; Petits chiens = « dogs » ;
 *  - disponible réel = reçu − réalisé ; disponible engagé = reçu − réalisé − prévu ;
 *  - dépense « au fur et à mesure » (lot 14) : réalisé = somme des passages ; prévu = ce qui reste
 *    du montant tant qu'elle est ouverte (jamais négatif). Clôturée, le reste redevient disponible.
 */

/**
 * Part réalisée et part prévue d'une dépense. Seule définition de la règle côté serveur
 * (budgets.js en a la copie pour le mode hors connexion).
 *
 * @return array{0: float, 1: float} [réalisé, prévu]
 */
function budgetEntrySplit(string $status, string $tracking, float $amount, float $consumed): array
{
    if ($status === 'cancelled') return [0.0, 0.0];
    if ($tracking === 'gradual') return [$consumed, $status === 'planned' ? max($amount - $consumed, 0.0) : 0.0];
    return $status === 'realised' ? [$amount, 0.0] : [0.0, $amount];
}

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
        "SELECT e.budget_id, e.bucket, e.status, e.tracking, e.amount, COALESCE(NULLIF(e.nature,''),'') nature,
                COALESCE(c.consumed,0) consumed
         FROM entries e
         LEFT JOIN (SELECT entry_id, SUM(amount) consumed FROM entry_consumptions GROUP BY entry_id) c ON c.entry_id=e.id
         WHERE e.type='expense' AND e.status IN ('planned','realised')"
    )->fetchAll(PDO::FETCH_ASSOC);
    foreach ($rows as $r) {
        if (!isset($totals[$r['budget_id']])) continue;
        $t = &$totals[$r['budget_id']];
        [$done, $planned] = budgetEntrySplit($r['status'], $r['tracking'], (float) $r['amount'], (float) $r['consumed']);
        $category = $r['bucket'] === 'dogs' ? 'dogs' : 'priority';
        foreach (['realised' => $done, 'planned' => $planned] as $key => $part) {
            $t[$key] += $part;
            $t[$category][$key] += $part;
            if ($r['nature'] !== '' && $part > 0) {
                $t['natures'][$r['nature']] ??= ['realised' => 0.0, 'planned' => 0.0];
                $t['natures'][$r['nature']][$key] += $part;
            }
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
