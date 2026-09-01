<?php
declare(strict_types=1);

// Définit ou change le mot de passe de l'application (lot 8).
// Exécutable UNIQUEMENT en ligne de commande : le mot de passe est saisi directement
// sur le serveur, il ne transite jamais par une page web, un fichier ou Git.
//
//   cd ~/depensesjosh.brightlightmind.online && php set-password.php

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require __DIR__ . '/auth.php';

/** Lit une saisie sans l'afficher à l'écran quand le terminal le permet. */
function budgetPromptHidden(string $label): string
{
    echo $label;
    $silenced = false;
    if (function_exists('shell_exec') && stripos(PHP_OS_FAMILY, 'win') === false) {
        $silenced = shell_exec('stty -echo 2>/dev/null') !== null || true;
        @shell_exec('stty -echo 2>/dev/null');
    }
    $value = trim((string) fgets(STDIN));
    if ($silenced) {
        @shell_exec('stty echo 2>/dev/null');
        echo PHP_EOL;
    }
    return $value;
}

try {
    $pdo = budgetAuthPdo();
} catch (Throwable $error) {
    fwrite(STDERR, 'Connexion à la base impossible : ' . $error->getMessage() . PHP_EOL);
    exit(2);
}

$exists = budgetHasPassword();
echo $exists
    ? "Un mot de passe est déjà défini. Cette opération le remplacera." . PHP_EOL
    : "Aucun mot de passe défini. Création du premier accès." . PHP_EOL;

$password = budgetPromptHidden('Nouveau mot de passe : ');
if (mb_strlen($password) < 10) {
    fwrite(STDERR, 'Trop court : 10 caractères minimum. Rien n’a été modifié.' . PHP_EOL);
    exit(1);
}

$confirm = budgetPromptHidden('Confirmez le mot de passe : ');
if (!hash_equals($password, $confirm)) {
    fwrite(STDERR, 'Les deux saisies diffèrent. Rien n’a été modifié.' . PHP_EOL);
    exit(1);
}

try {
    $pdo->prepare(
        'INSERT INTO app_credentials(id,password_hash) VALUES(1,?) ON DUPLICATE KEY UPDATE password_hash=VALUES(password_hash)'
    )->execute([password_hash($password, PASSWORD_DEFAULT)]);

    // Changer le mot de passe déconnecte tous les appareils : c'est le comportement
    // attendu si le changement fait suite à un doute sur la sécurité.
    $removed = $pdo->exec('DELETE FROM app_sessions');
    $pdo->exec('DELETE FROM app_login_attempts');
} catch (Throwable $error) {
    fwrite(STDERR, 'Enregistrement impossible : ' . $error->getMessage() . PHP_EOL);
    exit(2);
}

echo 'Mot de passe enregistré.' . PHP_EOL;
if ($removed) echo "Sessions fermées sur {$removed} appareil(s) : reconnectez-vous." . PHP_EOL;
