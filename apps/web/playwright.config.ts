import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
export default defineConfig({ testDir: './tests', workers: 1, retries: 0, expect: { timeout: 15000 }, timeout: 300_000,
  outputDir: '../../.logs/phase2-playwright', reporter: [['list'], ['json', { outputFile: fileURLToPath(new URL('../../.logs/phase2-playwright.json', import.meta.url)) }]],
  use: { baseURL: 'http://127.0.0.1:5175', channel: 'msedge', headless: true, viewport: { width: 1440, height: 1000 },
    screenshot: 'only-on-failure', trace: 'retain-on-failure', actionTimeout: 15000 },
});
