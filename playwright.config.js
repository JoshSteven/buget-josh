const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests', timeout: 30000, workers: 1,
  use: { baseURL: 'http://127.0.0.1:8080', viewport: { width: 390, height: 844 }, trace: 'retain-on-failure' }
});
