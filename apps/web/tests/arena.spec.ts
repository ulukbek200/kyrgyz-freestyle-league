import {test,expect} from '@playwright/test';
import {arenaResponse} from './arena-fixture';
import {palette} from '../src/theme';

// Isolated visual fixtures: no API server, credentials or database mutations.
test.beforeEach(async({page})=>{
 await page.route('**/api/**',route=>route.fulfill({json:arenaResponse(new URL(route.request().url()).pathname.replace(/^\/api/,''))}));
 await page.route('https://fonts.googleapis.com/**',route=>route.abort());
});
const publicRoutes=['/','/athletes','/athletes/a0','/rankings','/events','/events/e1','/events/e1?tab=schedule','/matches/m1','/champions','/media','/media/p1','/apply','/about','/admin'];
const adminRoutes=['/admin','/admin/athletes','/admin/events','/admin/rankings','/admin/champions','/admin/media','/admin/applications','/admin/settings'];
for(const width of [1440,390,320])test('populated public and admin layouts at '+width+'px',async({page},testInfo)=>{
 await page.setViewportSize({width,height:1000});
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 for(const [authenticated,routes] of [[false,publicRoutes],[true,adminRoutes]] as const){
  if(authenticated)await page.evaluate(()=>localStorage.setItem('nwl-token','isolated-visual-fixture'));
  for(const route of routes){
   await page.goto(route,{waitUntil:'domcontentloaded'});
   await expect(page.locator('h1,h2').first()).toBeVisible();
   await expect(page.getByText('Загрузка…',{exact:true})).toHaveCount(0);
   await page.evaluate(()=>document.fonts.ready);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth),route).toBeLessThanOrEqual(width);
   if(['/','/athletes','/matches/m1','/apply','/admin'].includes(route))await page.screenshot({path:testInfo.outputPath((authenticated?'workspace':'public')+route.split('/').join('_')+'.png'),fullPage:true});
  }
 }
 expect(errors).toEqual([]);
});
test('keyboard, mobile navigation, form labels and arena corners',async({page})=>{
 await page.setViewportSize({width:390,height:900});await page.goto('/');
 const skip=page.getByRole('link',{name:'Перейти к содержимому'});await skip.focus();await expect(skip).toBeFocused();
 await expect(skip).toHaveCSS('outline-style','solid');await skip.press('Enter');await expect(page.locator('#main-content')).toBeFocused();
 await page.getByRole('button',{name:'Открыть меню'}).click();await expect(page.getByRole('dialog')).toBeVisible();
 await page.getByRole('dialog').getByRole('link',{name:'Подать заявку'}).click();await expect(page).toHaveURL(/apply/);
 await page.getByRole('button',{name:'Отправить заявку'}).click();await expect(page.getByText('Обязательное поле').first()).toBeVisible();
 await expect(page.getByLabel('Имя',{exact:true})).toHaveAttribute('aria-invalid','true');
 await page.getByLabel('Имя',{exact:true}).focus();await expect(page.getByLabel('Имя',{exact:true})).toBeFocused();
 await page.goto('/matches/m1');await expect(page.getByText('Красный угол')).toBeVisible();await expect(page.getByText('Синий угол')).toBeVisible();
 await expect(page.locator('.corner-red .avatar')).toHaveCSS('border-bottom-color','rgb(217, 54, 62)');
 await expect(page.locator('.corner-blue .avatar')).toHaveCSS('border-bottom-color','rgb(14, 87, 173)');
});
test('brand text pairs meet WCAG AA normal-text contrast',()=>{
 function luminance(hex:string){const v=hex.slice(1).match(/../g)!.map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return v[0]*.2126+v[1]*.7152+v[2]*.0722;}
 for(const [fg,bg] of [[palette.ink,palette.white],[palette.muted,palette.light],[palette.white,palette.navy],[palette.white,palette.blue],[palette.navy,palette.yellow],[palette.darkMuted,palette.darkPanel],[palette.yellowInk,palette.yellowTint],[palette.red,palette.white]]){
  const a=luminance(fg),b=luminance(bg);expect((Math.max(a,b)+.05)/(Math.min(a,b)+.05),fg+' on '+bg).toBeGreaterThanOrEqual(4.5);
 }
});

test('mobile admin editors remain inside viewport with readable controls',async({page},testInfo)=>{
 await page.setViewportSize({width:390,height:900});
 await page.addInitScript(()=>localStorage.setItem('nwl-token','isolated-visual-fixture'));
 await page.goto('/admin/athletes');await page.getByRole('button',{name:'Добавить спортсмена',exact:true}).click();
 await page.getByRole('button',{name:'Выбрать U23',exact:true}).click();
 const editor=page.getByRole('dialog');await expect(editor).toBeVisible();
 await expect(page.getByLabel('Имя',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
 await page.screenshot({path:testInfo.outputPath('athlete-editor.png'),fullPage:true});
 await page.goto('/admin/events');await page.getByRole('button',{name:'Создать турнир',exact:true}).click();
 await expect(page.getByRole('dialog')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
 await page.screenshot({path:testInfo.outputPath('event-editor.png'),fullPage:true});
});
test('empty and failed API states retain navigation and recovery',async({page})=>{
 await page.route('**/api/athletes?**',route=>route.fulfill({json:{data:[],total:0}}));
 await page.goto('/athletes');await expect(page.getByText('Спортсмены не найдены')).toBeVisible();
 await page.route('**/api/media',route=>route.fulfill({status:503,json:{error:'Unavailable'}}));
 await page.goto('/media');await expect(page.getByRole('alert')).toContainText('Не удалось загрузить данные');
 await expect(page.getByRole('button',{name:'Повторить',exact:true})).toBeVisible();
 await expect(page.getByRole('navigation',{name:'Главная навигация'})).toBeVisible();
});
