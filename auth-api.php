<?php
declare(strict_types=1);

// Endpoints de connexion / déconnexion. Ce fichier est volontairement NON protégé
// par la garde d'authentification : c'est lui qui l'établit.

header('Content-Type: application/json; charset=utf-8');
require __DIR__ . '/auth.php';
budgetNoStore();

function authApiFail(string $message, int $status = 422): never
{
    http_response_code($status);
    echo json_encode(['error' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') authApiFail('Méthode non autorisée.', 405);

$action = (string) ($_GET['action'] ?? '');

if ($action === 'logout') {
    budgetEndSession();
    echo json_encode(['ok' => true], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($action !== 'login') authApiFail('Action inconnue.', 404);

try {
    $data = json_decode(file_get_contents('php://input'), true, 512, JSON_THROW_ON_ERROR);
} catch (Throwable) {
    authApiFail('Données invalides.');
}

if (!budgetHasPassword()) {
    authApiFail('Aucun mot de passe n’est défini sur le serveur.', 503);
}

// Le verrouillage est vérifié avant la tentative pour renvoyer un message explicite ;
// budgetAttemptLogin() le revérifie de son côté.
if (budgetTooManyAttempts()) {
    authApiFail('Trop de tentatives. Réessayez dans quelques minutes.', 429);
}

if (!budgetAttemptLogin((string) (is_array($data) ? ($data['password'] ?? '') : ''))) {
    authApiFail('Mot de passe incorrect.', 401);
}

echo json_encode(['ok' => true], JSON_UNESCAPED_UNICODE);
