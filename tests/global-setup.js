const { request } = require('@playwright/test');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Depuis le lot 8, toutes les pages et toutes les API sont derrière l'authentification.
// On ouvre donc une session une seule fois ici, et tous les tests la réutilisent via
// `storageState`. Le mot de passe local de test n'est jamais celui de la production :
// il se pose avec `php set-password.php` sur la base de développement.
const BASE_URL = process.env.BUDGET_JOSH_BASE_URL || 'http://127.0.0.1:8081';
const PASSWORD = process.env.BUDGET_JOSH_TEST_PASSWORD || 'test-local-jetable-2026';
const STATE_PATH = path.join(__dirname, '.auth-state.json');

module.exports = async () => {
  // Base de test neuve à chaque lancement : structure + données fictives + mot de passe de test.
  if (!process.env.BUDGET_JOSH_BASE_URL) {
    execFileSync(process.env.BUDGET_JOSH_PHP || 'php', [path.join(__dirname, 'reset-test-db.php')], {
      env: { ...process.env, BUDGET_JOSH_TEST_PASSWORD: PASSWORD },
      stdio: 'inherit',
    });
  }
  const context = await request.newContext({ baseURL: BASE_URL });
  const response = await context.post('/auth-api.php?action=login', {
    data: { password: PASSWORD },
  });

  if (!response.ok()) {
    const detail = await response.text().catch(() => '');
    throw new Error(
      `Connexion de test impossible (${response.status()}) sur ${BASE_URL}. ${detail}\n` +
      'Posez le mot de passe de test sur la base locale :\n' +
      '  php set-password.php\n' +
      `puis utilisez-le via BUDGET_JOSH_TEST_PASSWORD (défaut : « ${PASSWORD} »).`
    );
  }

  await context.storageState({ path: STATE_PATH });
  await context.dispose();

  if (!fs.existsSync(STATE_PATH)) throw new Error('La session de test n’a pas pu être enregistrée.');
};
