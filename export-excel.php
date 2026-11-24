<?php
declare(strict_types=1);

/*
 * Export Excel (lot 11) : vrai fichier .xlsx produit côté serveur avec PhpSpreadsheet.
 * Onglets : Synthèse, Dépenses, Par catégorie, Récurrences.
 * Règle : les dépenses annulées restent visibles dans l'onglet Dépenses mais sont exclues de tous les totaux.
 */

require __DIR__ . '/auth.php';
require __DIR__ . '/lib/budget-totals.php';
budgetRequireAuthPage();
require __DIR__ . '/vendor/autoload.php';

use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

const XL_ACCENT = '2456F5';
const XL_TEXT = '1D1D1F';
const XL_MUTED = '6E6E73';
const XL_STRIPE = 'F5F5F7';
const XL_LINE = 'E5E5EA';
const XL_MONEY = '#,##0 "F CFA";-#,##0 "F CFA";"-"';

$config = require __DIR__ . '/config.php';
$pdo = budgetDb();

$months = ['', 'janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
$monthLabel = static function (string $ym) use ($months): string {
    [$y, $m] = array_map('intval', explode('-', $ym));
    return $months[$m] . ' ' . $y;
};
$frDate = static function (?string $date) use ($months): string {
    if (!$date) return '';
    [$y, $m, $d] = array_map('intval', explode('-', substr($date, 0, 10)));
    return $d . ' ' . $months[$m] . ' ' . $y;
};

// Données
$budgets = $pdo->query(
    "SELECT b.id,b.kind,b.name,b.period_month,b.project_date,COALESCE(SUM(p.amount),0) received
     FROM budgets b LEFT JOIN budget_payments p ON p.budget_id=b.id
     GROUP BY b.id ORDER BY COALESCE(b.period_month,DATE_FORMAT(b.project_date,'%Y-%m')) DESC,b.created_at DESC"
)->fetchAll(PDO::FETCH_ASSOC);
$entries = $pdo->query(
    "SELECT budget_id,label,amount,bucket,nature,note,status,DATE_FORMAT(entry_date,'%Y-%m-%d') d,source
     FROM entries WHERE type='expense' ORDER BY entry_date DESC,created_at DESC"
)->fetchAll(PDO::FETCH_ASSOC);
$recurrences = $pdo->query(
    'SELECT label,amount,bucket,day_of_month,next_date,active FROM recurring_expenses ORDER BY active DESC,label'
)->fetchAll(PDO::FETCH_ASSOC);

$budgetName = [];
foreach ($budgets as $b) {
    $budgetName[$b['id']] = $b['kind'] === 'grace' ? 'Grâce ' . $monthLabel($b['period_month']) : $b['name'];
}
$category = static fn(string $bucket): string => $bucket === 'dogs' ? 'Petits chiens' : 'Priorités';
$statusLabel = ['realised' => 'Réalisée', 'planned' => 'Prévue', 'cancelled' => 'Annulée'];

// Agrégats : moteur de calcul unique (lib/budget-totals.php), annulées exclues
$totals = budgetTotals($pdo);
$agg = [];
$natures = [];
foreach ($budgets as $b) {
    $t = $totals[$b['id']];
    $agg[$b['id']] = [
        'realised' => $t['realised'], 'planned' => $t['planned'],
        'Priorités' => [$t['priority']['realised'], $t['priority']['planned']],
        'Petits chiens' => [$t['dogs']['realised'], $t['dogs']['planned']],
    ];
    $withNature = [0.0, 0.0];
    foreach ($t['natures'] as $name => $n) {
        $natures[$name] ??= [0.0, 0.0];
        $natures[$name][0] += $n['realised'];
        $natures[$name][1] += $n['planned'];
        $withNature[0] += $n['realised'];
        $withNature[1] += $n['planned'];
    }
    $rest = [$t['realised'] - $withNature[0], $t['planned'] - $withNature[1]];
    if ($rest[0] > 0 || $rest[1] > 0) {
        $natures['Sans nature'] ??= [0.0, 0.0];
        $natures['Sans nature'][0] += $rest[0];
        $natures['Sans nature'][1] += $rest[1];
    }
}

// Mise en forme commune
$book = new Spreadsheet();
$book->getProperties()->setCreator('Budget Josh')->setTitle('Budget Josh')->setDescription('Export des budgets et dépenses');
$book->getDefaultStyle()->getFont()->setName('Calibri')->setSize(11)->getColor()->setRGB(XL_TEXT);

$title = static function (Worksheet $sheet, string $text, string $subtitle, string $lastCol): void {
    $sheet->setCellValue('A1', $text);
    $sheet->getStyle('A1')->getFont()->setBold(true)->setSize(18);
    $sheet->setCellValue('A2', $subtitle);
    $sheet->getStyle('A2')->getFont()->setSize(10)->getColor()->setRGB(XL_MUTED);
    $sheet->getRowDimension(1)->setRowHeight(28);
    $sheet->getRowDimension(3)->setRowHeight(8);
    $sheet->getSheetView()->setZoomScale(110);
    $sheet->setShowGridlines(false);
};
$header = static function (Worksheet $sheet, int $row, array $labels): void {
    $sheet->fromArray($labels, null, 'A' . $row);
    $last = $sheet->getHighestColumn();
    $style = $sheet->getStyle("A$row:$last$row");
    $style->getFont()->setBold(true)->getColor()->setRGB('FFFFFF');
    $style->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB(XL_ACCENT);
    $style->getAlignment()->setVertical(Alignment::VERTICAL_CENTER);
    $sheet->getRowDimension($row)->setRowHeight(24);
};
$stripe = static function (Worksheet $sheet, int $from, int $to, string $lastCol): void {
    for ($r = $from; $r <= $to; $r++) {
        $style = $sheet->getStyle("A$r:$lastCol$r");
        $style->getBorders()->getBottom()->setBorderStyle(Border::BORDER_THIN)->getColor()->setRGB(XL_LINE);
        if (($r - $from) % 2 === 1) $style->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB(XL_STRIPE);
    }
};
$totalRow = static function (Worksheet $sheet, int $row, string $lastCol): void {
    $style = $sheet->getStyle("A$row:$lastCol$row");
    $style->getFont()->setBold(true);
    $style->getBorders()->getTop()->setBorderStyle(Border::BORDER_MEDIUM)->getColor()->setRGB(XL_TEXT);
    $sheet->getRowDimension($row)->setRowHeight(22);
};
$widths = static function (Worksheet $sheet, array $widths): void {
    foreach ($widths as $col => $w) $sheet->getColumnDimension($col)->setWidth($w);
};
$today = $frDate(date('Y-m-d'));

// 1. Synthèse
$sheet = $book->getActiveSheet()->setTitle('Synthèse');
$title($sheet, 'Budget Josh : synthèse', "Export du $today · montants en F CFA · dépenses annulées exclues", 'H');
$header($sheet, 4, ['Budget', 'Type', 'Reçu', 'Réalisé', 'Prévu', 'Disponible réel', 'Disponible engagé', 'Taux réalisé']);
$row = 5;
foreach ($budgets as $b) {
    $a = $agg[$b['id']];
    $sheet->fromArray([
        $budgetName[$b['id']], ['grace' => 'Grâce mensuelle', 'project' => 'Projet', 'tontine' => 'Tontine (épargne)'][$b['kind']] ?? $b['kind'],
        (float) $b['received'], $a['realised'], $a['planned'],
    ], null, "A$row");
    $sheet->setCellValue("F$row", "=C$row-D$row");
    $sheet->setCellValue("G$row", "=C$row-D$row-E$row");
    $sheet->setCellValue("H$row", "=IF(C$row=0,0,D$row/C$row)");
    $row++;
}
$last = $row - 1;
if ($last >= 5) $stripe($sheet, 5, $last, 'H');
$sheet->setCellValue("A$row", 'Total');
foreach (['C', 'D', 'E', 'F', 'G'] as $c) $sheet->setCellValue("$c$row", $last >= 5 ? "=SUM({$c}5:$c$last)" : 0);
$sheet->setCellValue("H$row", "=IF(C$row=0,0,D$row/C$row)");
$totalRow($sheet, $row, 'H');
$sheet->getStyle("C5:G$row")->getNumberFormat()->setFormatCode(XL_MONEY);
$sheet->getStyle("H5:H$row")->getNumberFormat()->setFormatCode('0%');
$sheet->getStyle("F5:G$row")->getFont()->setBold(true);
$widths($sheet, ['A' => 30, 'B' => 17, 'C' => 16, 'D' => 16, 'E' => 16, 'F' => 18, 'G' => 19, 'H' => 13]);
$sheet->freezePane('A5');

// 2. Dépenses
$sheet = $book->createSheet()->setTitle('Dépenses');
$title($sheet, 'Toutes les dépenses', 'Une ligne par dépense, de la plus récente à la plus ancienne. Utilise les flèches de filtre de la ligne 4.', 'H');
$header($sheet, 4, ['Date', 'Budget', 'Catégorie', 'Nature', 'Libellé', 'Montant', 'Statut', 'Note']);
$row = 5;
foreach ($entries as $e) {
    $sheet->fromArray([
        $e['d'] ? \PhpOffice\PhpSpreadsheet\Shared\Date::PHPToExcel(new DateTime($e['d'])) : '',
        $budgetName[$e['budget_id']] ?? '',
        $category($e['bucket']) . ($e['bucket'] === 'tithe' ? ' (dîme)' : ''),
        $e['nature'] ?: '',
        $e['label'] . ($e['source'] === 'recurring' ? ' ↻' : ''),
        (float) $e['amount'],
        $statusLabel[$e['status']] ?? $e['status'],
        $e['note'] ?: '',
    ], null, "A$row");
    if ($e['status'] === 'cancelled') {
        $sheet->getStyle("A$row:H$row")->getFont()->setStrikethrough(true)->getColor()->setRGB('A1A1A6');
    } elseif ($e['status'] === 'realised') {
        $sheet->getStyle("G$row")->getFont()->getColor()->setRGB(XL_ACCENT);
    }
    $row++;
}
$last = $row - 1;
if ($last >= 5) {
    $stripe($sheet, 5, $last, 'H');
    $sheet->setAutoFilter("A4:H$last");
}
$sheet->getStyle("A5:A$row")->getNumberFormat()->setFormatCode('dd/mm/yyyy');
$sheet->getStyle("F5:F$row")->getNumberFormat()->setFormatCode(XL_MONEY);
$sheet->getStyle("G5:G$row")->getFont()->setBold(true);
$row++;
$sheet->setCellValue("E$row", 'Total réalisé');
$sheet->setCellValue("F$row", $last >= 5 ? "=SUMIFS(F5:F$last,G5:G$last,\"Réalisée\")" : 0);
$sheet->setCellValue("E" . ($row + 1), 'Total prévu');
$sheet->setCellValue("F" . ($row + 1), $last >= 5 ? "=SUMIFS(F5:F$last,G5:G$last,\"Prévue\")" : 0);
$sheet->getStyle("E$row:F" . ($row + 1))->getFont()->setBold(true);
$sheet->getStyle("F$row:F" . ($row + 1))->getNumberFormat()->setFormatCode(XL_MONEY);
$sheet->setCellValue("A" . ($row + 3), '↻ = dépense ajoutée par une récurrence. Les lignes barrées sont annulées et ne comptent dans aucun total.');
$sheet->getStyle("A" . ($row + 3))->getFont()->setSize(10)->getColor()->setRGB(XL_MUTED);
$widths($sheet, ['A' => 12, 'B' => 26, 'C' => 18, 'D' => 24, 'E' => 34, 'F' => 15, 'G' => 11, 'H' => 34]);
$sheet->freezePane('A5');

// 3. Par catégorie
$sheet = $book->createSheet()->setTitle('Par catégorie');
$title($sheet, 'Répartition par catégorie', 'Priorités (dîme comprise) et Petits chiens, par budget · annulées exclues', 'G');
$header($sheet, 4, ['Budget', 'Priorités réalisé', 'Priorités prévu', 'Petits chiens réalisé', 'Petits chiens prévu', 'Total engagé', 'Part Petits chiens']);
$row = 5;
foreach ($budgets as $b) {
    $a = $agg[$b['id']];
    $sheet->fromArray([$budgetName[$b['id']], $a['Priorités'][0], $a['Priorités'][1], $a['Petits chiens'][0], $a['Petits chiens'][1]], null, "A$row");
    $sheet->setCellValue("F$row", "=SUM(B$row:E$row)");
    $sheet->setCellValue("G$row", "=IF(F$row=0,0,(D$row+E$row)/F$row)");
    $row++;
}
$last = $row - 1;
if ($last >= 5) $stripe($sheet, 5, $last, 'G');
$sheet->setCellValue("A$row", 'Total');
foreach (['B', 'C', 'D', 'E', 'F'] as $c) $sheet->setCellValue("$c$row", $last >= 5 ? "=SUM({$c}5:$c$last)" : 0);
$sheet->setCellValue("G$row", "=IF(F$row=0,0,(D$row+E$row)/F$row)");
$totalRow($sheet, $row, 'G');
$sheet->getStyle("B5:F$row")->getNumberFormat()->setFormatCode(XL_MONEY);
$sheet->getStyle("G5:G$row")->getNumberFormat()->setFormatCode('0%');

$row += 3;
$sheet->setCellValue("A$row", 'Par nature, tous budgets confondus');
$sheet->getStyle("A$row")->getFont()->setBold(true)->setSize(14);
$row += 1;
$header($sheet, $row, ['Nature', 'Réalisé', 'Prévu', 'Total engagé']);
// L'en-tête de nature ne doit pas colorer les colonnes E à G restées vides.
$sheet->getStyle("E$row:G$row")->getFill()->setFillType(Fill::FILL_NONE);
uasort($natures, static fn($x, $y) => ($y[0] + $y[1]) <=> ($x[0] + $x[1]));
$start = ++$row;
foreach ($natures as $name => [$done, $planned]) {
    $sheet->fromArray([$name, $done, $planned], null, "A$row");
    $sheet->setCellValue("D$row", "=B$row+C$row");
    $row++;
}
if ($row > $start) {
    $stripe($sheet, $start, $row - 1, 'D');
    $sheet->getStyle("B$start:D" . ($row - 1))->getNumberFormat()->setFormatCode(XL_MONEY);
}
$widths($sheet, ['A' => 32, 'B' => 18, 'C' => 17, 'D' => 21, 'E' => 20, 'F' => 16, 'G' => 18]);
$sheet->freezePane('A5');

// 4. Récurrences
$sheet = $book->createSheet()->setTitle('Récurrences');
$title($sheet, 'Dépenses récurrentes', 'Ajoutées chaque mois comme prévues dans la Grâce du mois', 'F');
$header($sheet, 4, ['Libellé', 'Montant', 'Catégorie', 'Jour du mois', 'Prochaine date', 'État']);
$row = 5;
foreach ($recurrences as $r) {
    $sheet->fromArray([
        $r['label'], (float) $r['amount'], $category($r['bucket']), (int) $r['day_of_month'],
        $frDate($r['next_date']), (int) $r['active'] === 1 ? 'Active' : 'En pause',
    ], null, "A$row");
    $row++;
}
if ($row === 5) {
    $sheet->setCellValue('A5', 'Aucune dépense récurrente.');
    $sheet->getStyle('A5')->getFont()->getColor()->setRGB(XL_MUTED);
} else {
    $last = $row - 1;
    $stripe($sheet, 5, $last, 'F');
    $sheet->setCellValue("A$row", 'Total mensuel des récurrences actives');
    $sheet->setCellValue("B$row", "=SUMIFS(B5:B$last,F5:F$last,\"Active\")");
    $totalRow($sheet, $row, 'F');
    $sheet->getStyle("B5:B$row")->getNumberFormat()->setFormatCode(XL_MONEY);
}
$widths($sheet, ['A' => 34, 'B' => 16, 'C' => 16, 'D' => 14, 'E' => 18, 'F' => 12]);

$book->setActiveSheetIndex(0);

// Envoi
budgetNoStore();
$filename = 'budget-josh-' . date('Y-m-d') . '.xlsx';
header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
header('Content-Disposition: attachment; filename="' . $filename . '"');
(new Xlsx($book))->save('php://output');
