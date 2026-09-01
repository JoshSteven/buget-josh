const { defineConfig } = require('@playwright/test');
const path = require('path');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30000,
  workers: 1,
  // Ouvre une session avant la suite : depuis le lot 8, pages et API exigent l'authentification.
  globalSetup: require.resolve('./tests/global-setup.js'),
  use: {
    baseURL: process.env.BUDGET_JOSH_BASE_URL || 'http://127.0.0.1:8080',
    viewport: { width: 390, height: 844 },
    trace: 'retain-on-failure',
    storageState: path.join(__dirname, 'tests', '.auth-state.json'),
  },
});
