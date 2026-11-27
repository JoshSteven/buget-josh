<?php
declare(strict_types=1);

/* Test unitaire de la règle réalisé / prévu (lot 14), sans base de données. Lancé par gradual-expenses.spec.js. */

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require dirname(__DIR__) . '/lib/budget-totals.php';

// [libellé, statut, suivi, montant, consommé, réalisé attendu, prévu attendu]
$cases = [
    ['en une fois, prévue', 'planned', 'single', 6000, 0, 0, 6000],
    ['en une fois, réalisée', 'realised', 'single', 6000, 0, 6000, 0],
    ['en une fois, annulée', 'cancelled', 'single', 6000, 0, 0, 0],
    ['au fur et à mesure, rien', 'planned', 'gradual', 6000, 0, 0, 6000],
    ['au fur et à mesure, une séance', 'planned', 'gradual', 6000, 2000, 2000, 4000],
    ['au fur et à mesure, tout juste', 'planned', 'gradual', 6000, 6000, 6000, 0],
    ['au fur et à mesure, dépassement', 'planned', 'gradual', 15000, 17500, 17500, 0],
    ['clôturée, reste libéré', 'realised', 'gradual', 15000, 12000, 12000, 0],
    ['clôturée sans passage', 'realised', 'gradual', 6000, 0, 0, 0],
    ['clôturée avec dépassement', 'realised', 'gradual', 6000, 8000, 8000, 0],
    ['au fur et à mesure, annulée', 'cancelled', 'gradual', 6000, 0, 0, 0],
    ['montants à centimes', 'planned', 'gradual', 100.5, 0.25, 0.25, 100.25],
];

$failures = 0;
foreach ($cases as [$label, $status, $tracking, $amount, $consumed, $done, $planned]) {
    [$gotDone, $gotPlanned] = budgetEntrySplit($status, $tracking, (float) $amount, (float) $consumed);
    if (abs($gotDone - $done) > 0.001 || abs($gotPlanned - $planned) > 0.001) {
        $failures++;
        echo "ÉCHEC $label : réalisé $gotDone (attendu $done), prévu $gotPlanned (attendu $planned)\n";
    }
}
echo $failures ? "$failures cas en échec\n" : 'OK ' . count($cases) . " cas\n";
exit($failures ? 1 : 0);
