<?php
declare(strict_types=1);

// Authentification applicative (lot 8). Remplace le Basic Auth cPanel, qui avait deux
// défauts : il a déjà sauté une fois lors d'un déploiement rsync (site public avec de
// vraies données financières), et il empêche l'installation propre de la PWA
// (manifest.webmanifest renvoyait 401).
//
// Principe : mot de passe unique + session longue durée sur l'appareil de confiance.
// Le mot de passe n'existe qu'en hash, le jeton de session qu'en SHA-256.

const BUDGET_SESSION_COOKIE = 'bj_session';
const BUDGET_SESSION_DAYS = 90;
const BUDGET_MAX_ATTEMPTS = 8;
const BUDGET_ATTEMPT_WINDOW_MINUTES = 15;

function budgetAuthPdo(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) return $pdo;
    $config = require __DIR__ . '/config.php';
    $pdo = new PDO(
        "mysql:host={$config['host']};dbname={$config['database']};charset=utf8mb4",
        $config['username'],
        $config['password'],
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
    return $pdo;
}

function budgetIsHttps(): bool
{
    if (!empty($_SERVER['HTTPS']) && strtolower((string) $_SERVER['HTTPS']) !== 'off') return true;
    return strtolower((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https';
}

function budgetIpHash(): string
{
    return hash('sha256', (string) ($_SERVER['REMOTE_ADDR'] ?? ''));
}

/** Un mot de passe a-t-il déjà été défini ? Sinon l'application reste fermée. */
function budgetHasPassword(): bool
{
    try {
        return (bool) budgetAuthPdo()->query('SELECT password_hash FROM app_credentials WHERE id=1')->fetchColumn();
    } catch (Throwable) {
        return false;
    }
}

/**
 * Session valide ? Prolonge l'échéance au plus une fois par jour pour éviter
 * une écriture à chaque requête.
 */
function budgetSessionIsValid(): bool
{
    $token = (string) ($_COOKIE[BUDGET_SESSION_COOKIE] ?? '');
    if (strlen($token) !== 64 || !ctype_xdigit($token)) return false;

    try {
        $pdo = budgetAuthPdo();
        $hash = hash('sha256', $token);
        $query = $pdo->prepare('SELECT last_seen_at FROM app_sessions WHERE token_hash=? AND expires_at>NOW()');
        $query->execute([$hash]);
        $lastSeen = $query->fetchColumn();
        if ($lastSeen === false) return false;

        if (strtotime((string) $lastSeen) < time() - 86400) {
            $pdo->prepare('UPDATE app_sessions SET last_seen_at=NOW(), expires_at=DATE_ADD(NOW(), INTERVAL ? DAY) WHERE token_hash=?')
                ->execute([BUDGET_SESSION_DAYS, $hash]);
        }
        return true;
    } catch (Throwable) {
        // En cas de base indisponible on refuse l'accès plutôt que de l'ouvrir.
        return false;
    }
}

function budgetTooManyAttempts(): bool
{
    try {
        $query = budgetAuthPdo()->prepare(
            'SELECT COUNT(*) FROM app_login_attempts WHERE ip_hash=? AND attempted_at > DATE_SUB(NOW(), INTERVAL ? MINUTE)'
        );
        $query->execute([budgetIpHash(), BUDGET_ATTEMPT_WINDOW_MINUTES]);
        return (int) $query->fetchColumn() >= BUDGET_MAX_ATTEMPTS;
    } catch (Throwable) {
        return true;
    }
}

function budgetRecordFailedAttempt(): void
{
    try {
        budgetAuthPdo()->prepare('INSERT INTO app_login_attempts(ip_hash,attempted_at) VALUES(?,NOW())')
            ->execute([budgetIpHash()]);
        // Purge opportuniste : la table ne doit pas grandir indéfiniment.
        budgetAuthPdo()->exec('DELETE FROM app_login_attempts WHERE attempted_at < DATE_SUB(NOW(), INTERVAL 1 DAY)');
    } catch (Throwable) {
        // Un échec de journalisation ne doit pas ouvrir l'accès ni casser la réponse.
    }
}

function budgetStartSession(): void
{
    $token = bin2hex(random_bytes(32));
    $pdo = budgetAuthPdo();
    $pdo->prepare(
        'INSERT INTO app_sessions(token_hash,last_seen_at,expires_at,user_agent) VALUES(?,NOW(),DATE_ADD(NOW(), INTERVAL ? DAY),?)'
    )->execute([
        hash('sha256', $token),
        BUDGET_SESSION_DAYS,
        mb_substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 255),
    ]);
    // Purge des sessions expirées, au moment le plus naturel.
    $pdo->exec('DELETE FROM app_sessions WHERE expires_at < NOW()');

    setcookie(BUDGET_SESSION_COOKIE, $token, [
        'expires' => time() + BUDGET_SESSION_DAYS * 86400,
        'path' => '/',
        'secure' => budgetIsHttps(),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

function budgetEndSession(): void
{
    $token = (string) ($_COOKIE[BUDGET_SESSION_COOKIE] ?? '');
    if ($token !== '') {
        try {
            budgetAuthPdo()->prepare('DELETE FROM app_sessions WHERE token_hash=?')->execute([hash('sha256', $token)]);
        } catch (Throwable) {
            // La suppression du cookie ci-dessous suffit côté client.
        }
    }
    setcookie(BUDGET_SESSION_COOKIE, '', [
        'expires' => time() - 3600,
        'path' => '/',
        'secure' => budgetIsHttps(),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

/** Renvoie true si la connexion réussit. Gère le verrouillage et la journalisation. */
function budgetAttemptLogin(string $password): bool
{
    if ($password === '' || budgetTooManyAttempts()) return false;

    try {
        $hash = (string) budgetAuthPdo()->query('SELECT password_hash FROM app_credentials WHERE id=1')->fetchColumn();
    } catch (Throwable) {
        return false;
    }

    if ($hash === '' || !password_verify($password, $hash)) {
        budgetRecordFailedAttempt();
        return false;
    }

    if (password_needs_rehash($hash, PASSWORD_DEFAULT)) {
        try {
            budgetAuthPdo()->prepare('UPDATE app_credentials SET password_hash=? WHERE id=1')
                ->execute([password_hash($password, PASSWORD_DEFAULT)]);
        } catch (Throwable) {
            // Le rehash est un confort, son échec ne doit pas bloquer la connexion.
        }
    }

    try {
        budgetAuthPdo()->prepare('DELETE FROM app_login_attempts WHERE ip_hash=?')->execute([budgetIpHash()]);
    } catch (Throwable) {
        // Idem : purge de confort.
    }

    budgetStartSession();
    return true;
}

/** Garde pour une page HTML : redirige vers l'écran de connexion. */
function budgetRequireAuthPage(): void
{
    if (budgetSessionIsValid()) return;
    $next = (string) ($_SERVER['REQUEST_URI'] ?? '/index.php');
    header('Location: login.php?next=' . rawurlencode($next), true, 302);
    exit;
}

/** Garde pour un endpoint JSON : 401 exploitable par le front. */
function budgetRequireAuthApi(): void
{
    if (budgetSessionIsValid()) return;
    http_response_code(401);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'Session expirée. Reconnectez-vous.', 'auth' => false], JSON_UNESCAPED_UNICODE);
    exit;
}
