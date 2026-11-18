<?php
declare(strict_types=1);

/*
 * Socle commun (lot Fondations, novembre 2026) : une seule connexion à la base,
 * des réponses JSON homogènes, une lecture validée des données reçues et un contrôle
 * d'origine des requêtes. Chargé par auth.php, donc par toutes les pages et API.
 */

const BUDGET_FIRST_MONTH = '2026-06';

/** Configuration MySQL. Une base de test peut être choisie en local uniquement (nom finissant par _test). */
function budgetConfig(): array
{
    static $config = null;
    if ($config !== null) return $config;
    $config = require dirname(__DIR__) . '/config.php';
    $testDb = (string) getenv('BUDGET_JOSH_DB');
    if ($testDb !== '' && str_ends_with($testDb, '_test')) {
        $config['database'] = $testDb;
    }
    return $config;
}

function budgetDb(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) return $pdo;
    $c = budgetConfig();
    $pdo = new PDO(
        "mysql:host={$c['host']};dbname={$c['database']};charset=utf8mb4",
        $c['username'],
        $c['password'],
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
    );
    return $pdo;
}

function budgetJson(array $data, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function budgetFail(string $message, int $status = 422): never
{
    budgetJson(['error' => $message], $status);
}

/** Corps JSON de la requête, ou erreur 422. */
function budgetBody(): array
{
    try {
        $data = json_decode((string) file_get_contents('php://input'), true, 512, JSON_THROW_ON_ERROR);
    } catch (Throwable) {
        budgetFail('Données invalides.');
    }
    if (!is_array($data)) budgetFail('Données invalides.');
    return $data;
}

/* Lecture validée d'un champ. Chaque fonction renvoie la valeur propre ou arrête la requête. */

function budgetText(array $d, string $key, int $max = 180, bool $required = true): ?string
{
    $value = trim((string) ($d[$key] ?? ''));
    if ($value === '') {
        if ($required) budgetFail('Champ obligatoire manquant : ' . $key . '.');
        return null;
    }
    return mb_substr($value, 0, $max);
}

function budgetAmount(array $d, string $key = 'amount'): float
{
    $value = $d[$key] ?? null;
    if (!is_numeric($value) || (float) $value <= 0 || (float) $value > 1e12) budgetFail('Montant positif requis.');
    return round((float) $value, 2);
}

function budgetDate(array $d, string $key): string
{
    $value = (string) ($d[$key] ?? '');
    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
    if (!$date || $date->format('Y-m-d') !== $value) budgetFail('Date invalide.');
    return $value;
}

function budgetMonth(array $d, string $key): string
{
    $value = (string) ($d[$key] ?? '');
    if (!preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $value)) budgetFail('Mois invalide.');
    return $value;
}

function budgetId(array $d, string $key = 'id'): string
{
    $value = (string) ($d[$key] ?? '');
    if (!preg_match('/^[A-Za-z0-9-]{8,64}$/', $value)) budgetFail('Identifiant invalide.');
    return $value;
}

/*
 * Contrôle d'origine : deuxième barrière derrière le cookie SameSite=Lax.
 * Une requête qui modifie des données doit venir de l'application elle-même.
 */
function budgetRequireSameOrigin(): void
{
    $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
    if (in_array($method, ['GET', 'HEAD', 'OPTIONS'], true)) return;
    $site = strtolower((string) ($_SERVER['HTTP_SEC_FETCH_SITE'] ?? ''));
    if ($site !== '' && !in_array($site, ['same-origin', 'none'], true)) budgetJson(['error' => 'Origine refusée.'], 403);
    $origin = (string) ($_SERVER['HTTP_ORIGIN'] ?? '');
    if ($origin === '') return;
    $originHost = strtolower((string) parse_url($origin, PHP_URL_HOST));
    $hostHeader = strtolower(explode(':', (string) ($_SERVER['HTTP_HOST'] ?? ''))[0]);
    if ($originHost === '' || $originHost !== $hostHeader) budgetJson(['error' => 'Origine refusée.'], 403);
}
