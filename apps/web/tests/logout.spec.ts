import {test, expect} from '@playwright/test';
import {readFileSync, mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

test('administrator login, logout, reload and protected API after logout', async ({page}) => {
  const credentials = JSON.parse(readFileSync(new URL('../../../.local/browser-admin.json', import.meta.url), 'utf8'));
  await page.goto('/admin');
  await page.getByLabel('Email', {exact: true}).fill(credentials.email);
  await page.getByLabel('Пароль', {exact: true}).fill(credentials.password);
  await page.getByRole('button', {name: 'Войти в центр управления', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Выйти', exact: true})).toBeVisible();
  expect(await page.evaluate(() => Boolean(localStorage.getItem('nwl-token')))).toBe(true);
  await expect(page.getByRole('heading', {name: 'Быстрые действия', exact: true})).toBeVisible();
  const directory = fileURLToPath(new URL('../../../docs/admin3-evidence/', import.meta.url));
  mkdirSync(directory, {recursive: true});
  await page.screenshot({path: directory + 'admin-login.png', fullPage: false});
  await page.getByRole('button', {name: 'Выйти', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Войти в центр управления', exact: true})).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('nwl-token') === null)).toBe(true);
  await page.reload();
  await expect(page.getByRole('button', {name: 'Войти в центр управления', exact: true})).toBeVisible();
  const response = await page.request.get('http://127.0.0.1:4400/api/admin/dashboard');
  expect(response.status()).toBe(401);
  await page.screenshot({path: directory + 'admin-logout.png', fullPage: false});
});
