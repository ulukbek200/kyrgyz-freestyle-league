import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const artifact=fileURLToPath(new URL('../../../.logs/phase2/',import.meta.url));
test.beforeAll(async({request})=>{const r=await request.get('/api/__qa/status');expect(r.ok()).toBeTruthy();expect((await r.json()).isolated).toBe(true);});
test('public errors, retry, empty search and keyboard focus',async({page})=>{
  await page.goto('/unknown-page');await expect(page.getByText('Страница не найдена',{exact:true})).toBeVisible();
  for(const url of ['/athletes/missing','/events/missing','/matches/missing','/media/missing']){await page.goto(url);await expect(page.getByText('Страница не найдена',{exact:true})).toBeVisible();}
  // Failure injection only; all successful data still comes from the real API.
  await page.route('**/api/home',route=>route.fulfill({status:500,json:{error:'Injected QA outage'}}));await page.goto('/');await expect(page.getByText('Не удалось загрузить данные',{exact:true})).toBeVisible();await expect(page.locator('.loading-state')).toHaveCount(0);await page.unroute('**/api/home');await page.getByRole('button',{name:'Повторить',exact:true}).click();await expect(page.getByRole('heading',{name:'Ближайшее событие',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Открыть поиск'}).click();const input=page.getByRole('combobox',{name:'Поиск спортсменов, событий, матчей и медиа'});await expect(input).toBeFocused();await input.fill('no-such-person-000000');await expect(page.getByText('Ничего не найдено. Попробуйте другое имя.')).toBeVisible();await input.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByRole('button',{name:'Открыть поиск'})).toBeFocused();
  await page.goto('/athletes');await page.getByRole('textbox',{name:'Поиск спортсмена',exact:true}).fill('no-such-person-000000');await expect(page.getByText('Пока ничего нет',{exact:true})).toBeVisible();
  await page.goto('/apply');await page.getByRole('button',{name:'Отправить заявку'}).click();await expect(page.getByText('Обязательное поле').first()).toBeVisible();
});
test('broken portrait fallback, ranking chart, profile tabs and admin 403',async({page,request})=>{
  const d=JSON.parse(fs.readFileSync(artifact+'data.json','utf8'));const a=d.athletes.find((a:any)=>a.firstName.startsWith('QAFirst'));const auth=await request.post('/api/auth/login',{data:{email:'qa@example.test',password:'qa-local-only-2026'}});expect(auth.ok()).toBeTruthy();const headers={Authorization:'Bearer '+(await auth.json()).token};
  const r=await request.patch('/api/admin/athletes/'+a.id,{headers,data:{photoUrl:'/qa-image-missing.png'}});expect(r.ok()).toBeTruthy();
  try{await page.goto('/athletes/'+a.slug);await expect(page.locator('.profile-top .portrait svg')).toBeVisible();await expect(page.locator('.profile-top .portrait img')).toHaveCount(0);await page.getByRole('tab',{name:'Рейтинг',exact:true}).click();await expect(page.locator('.recharts-wrapper')).toBeVisible({timeout:30000});await page.screenshot({animations:"disabled",path:artifact+'ranking-chart.png',fullPage:true});for(const name of ['Матчи','Карьера','Медиа','Обзор']){await page.getByRole('tab',{name,exact:true}).click();await expect(page.locator('.ant-tabs-tabpane-active')).toBeVisible();}}
  finally{await request.patch('/api/admin/athletes/'+a.id,{headers,data:{photoUrl:null}});}
  await page.context().addCookies([]);await page.goto('/admin/login');await page.getByLabel('Email',{exact:true}).fill('qa@example.test');await page.getByLabel('Пароль',{exact:true}).fill('qa-local-only-2026');await page.getByRole('button',{name:'Войти',exact:true}).click();await expect(page.locator('.admin-title')).toBeVisible();
  await page.route('**/api/auth/me',route=>route.fulfill({status:403,json:{error:'Injected forbidden response'}}));await page.goto('/admin');await expect(page.getByText('Доступ ограничен',{exact:true})).toBeVisible();
});
