import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests',testMatch:'divisions.spec.ts',workers:1,retries:0,timeout:60000,reporter:'list',outputDir:'../../.local/division-browser-results',use:{baseURL:'http://localhost:5173',channel:'msedge',headless:true,viewport:{width:1440,height:1000},trace:'off'}});
