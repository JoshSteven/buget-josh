<?php
declare(strict_types=1);

/* Relit un export .xlsx et renvoie une feuille en JSON, formules calculées. Usage : php read-xlsx.php fichier feuille */

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require dirname(__DIR__) . '/vendor/autoload.php';

$reader = new \PhpOffice\PhpSpreadsheet\Reader\Xlsx();
$sheet = $reader->load($argv[1])->getSheetByName($argv[2]);
echo json_encode($sheet->toArray(null, true, false, false), JSON_UNESCAPED_UNICODE);
