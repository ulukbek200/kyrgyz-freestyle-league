import {defineConfig} from '@playwright/test';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
export default defineConfig({
  testDir: './tests', workers: 1, retries: 0, timeout: 30000,
  reporter: 'list', outputDir: resolve(root, '.local/browser-results'),
  use: {baseURL: 'http://127.0.0.1:5175', channel: 'msedge', headless: true,
    viewport: {width: 1440, height: 1000}, trace: 'off', video: 'off'},
  webServer: [
    {command: 'node --import tsx apps/api/src/server.ts', cwd: root, url: 'http://127.0.0.1:4400/api/health',
      env: {PORT: '4400', WEB_ORIGIN: 'http://127.0.0.1:5175'}, reuseExistingServer: false, timeout: 30000},
    {command: 'node node_modules/vite/bin/vite.js apps/web --host 127.0.0.1 --port 5175 --strictPort', cwd: root, url: 'http://127.0.0.1:5175',
      env: {VITE_API_URL: 'http://127.0.0.1:4400/api'}, reuseExistingServer: false, timeout: 30000},
  ],
});
