const { defineConfig } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// Lot Fondations : les tests tournent sur leur propre serveur (port 8081) branché sur une
// base dédiée, budget_josh_test, recréée avant chaque lancement (tests/global-setup.js).
// La base de développement budget_josh n'est donc plus jamais modifiée par les tests.
const TEST_DB = process.env.BUDGET_JOSH_DB || 'budget_josh_test';
const LARAGON_PHP = 'D:/laragon/bin/php/php-8.3.30-Win32-vs16-x64/php.exe';
const PHP = process.env.BUDGET_JOSH_PHP || (fs.existsSync(LARAGON_PHP) ? LARAGON_PHP : 'php');
const BASE_URL = process.env.BUDGET_JOSH_BASE_URL || 'http://127.0.0.1:8081';
process.env.BUDGET_JOSH_DB = TEST_DB;
process.env.BUDGET_JOSH_PHP = PHP;

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30000,
  workers: 1,
  globalSetup: require.resolve('./tests/global-setup.js'),
  webServer: process.env.BUDGET_JOSH_BASE_URL ? undefined : {
    command: `"${PHP}" -S 127.0.0.1:8081 -t "${__dirname}"`,
    url: 'http://127.0.0.1:8081/login.php',
    env: { ...process.env, BUDGET_JOSH_DB: TEST_DB },
    reuseExistingServer: false,
    timeout: 20000,
  },
  use: {
    baseURL: BASE_URL,
    viewport: { width: 390, height: 844 },
    trace: 'retain-on-failure',
    storageState: path.join(__dirname, 'tests', '.auth-state.json'),
  },
});
