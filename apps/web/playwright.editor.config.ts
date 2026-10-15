import {defineConfig} from '@playwright/test';
import base from './playwright.config';

export default defineConfig({...base, testMatch: 'editor.spec.ts', timeout: 60000,
  use: {...base.use, baseURL: process.env.EDITOR_LIVE_URL || base.use?.baseURL},
  webServer: process.env.EDITOR_LIVE_URL ? [] : base.webServer,
});
