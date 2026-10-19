import {defineConfig} from '@playwright/test';
import {fileURLToPath} from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
export default defineConfig({
 testDir:'./tests', testMatch:'arena.spec.ts', workers:1, timeout:120000,
 reporter:'list', outputDir:root+'/.local/arena-browser-results',
 use:{baseURL:'http://127.0.0.1:5187',channel:'msedge',headless:true,reducedMotion:'reduce'},
 webServer:{command:'node node_modules/vite/bin/vite.js apps/web --host 127.0.0.1 --port 5187 --strictPort',cwd:root,url:'http://127.0.0.1:5187',reuseExistingServer:false},
});
