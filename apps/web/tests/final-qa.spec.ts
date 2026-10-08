import { test, expect, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const out=fileURLToPath(new URL('../../../.logs/final-qa/',import.meta.url));
const fixture=fileURLToPath(new URL('../../../.logs/phase2/data.json',import.meta.url));
const widths=[320,360,375,390,430,768,1024,1280,1440,1920];
const data=()=>JSON.parse(fs.readFileSync(fixture,'utf8'));
test.beforeAll(async({request})=>{const r=await request.get('/api/__qa/status');expect(r.ok()).toBeTruthy();expect((await r.json()).schema).toMatch(/^hardening_test_[0-9a-f]{16}$/);});
async function login(page:Page){await page.goto('/admin/login');await page.getByLabel('Email',{exact:true}).fill('qa@example.test');await page.getByLabel('Пароль',{exact:true}).fill('qa-local-only-2026');await page.getByRole('button',{name:'Войти',exact:true}).click();await expect(page.locator('.admin-title')).toBeVisible();}
async function ready(page:Page){await expect(page.locator('.loading-state')).toHaveCount(0);await expect(page.locator('.ant-spin-spinning')).toHaveCount(0);await page.evaluate(()=>document.fonts.ready);}
async function select(page:Page,label:string,text:string){await page.getByLabel(label,{exact:true}).and(page.getByRole('combobox')).press('ArrowDown');await page.locator('.ant-select-dropdown:visible .ant-select-item-option-content').filter({hasText:text}).click();}

test('accessibility: pages, form errors, dialogs, duplicate ids and labels',async({page})=>{
  const d=data(),rows:any[]=[];
  async function audit(name:string){
    await ready(page);
    const dom=await page.evaluate(()=>{
      const ids=Array.from(document.querySelectorAll('[id]')).map(e=>e.id).filter(Boolean);
      const duplicateIds=[...new Set(ids.filter((id,i)=>ids.indexOf(id)!==i))];
      const brokenLabels=Array.from(document.querySelectorAll('label[for]')).filter(e=>e.getClientRects().length&&!document.getElementById(e.getAttribute('for')!)).map(e=>e.outerHTML);
      return {duplicateIds,brokenLabels};
    });
    const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
    const violations=result.violations.map(v=>({id:v.id,impact:v.impact,description:v.description,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}));
    rows.push({name,...dom,violations,incomplete:result.incomplete.map(v=>v.id)});
    fs.writeFileSync(out+'accessibility.json',JSON.stringify(rows,null,2));
    expect.soft(dom.duplicateIds,name+' duplicate IDs').toEqual([]);expect.soft(dom.brokenLabels,name+' label/htmlFor').toEqual([]);expect.soft(violations,name+' axe').toEqual([]);
  }
  for(const route of ['/','/athletes','/athletes/'+d.athletes.find((a:any)=>a.firstName.startsWith('QAFirst')).slug,'/rankings','/events','/events/'+d.event.slug,'/matches','/matches/'+d.matches[0].id,'/champions','/media','/media/'+d.media.slug,'/apply','/admin/login']){
    await page.goto(route);await page.locator('h1').first().waitFor();await audit(route);
  }
  await page.goto('/apply');await page.getByRole('button',{name:'Отправить заявку'}).click();await expect(page.locator('.ant-form-item-explain-error').first()).toBeVisible();await audit('application errors');
  await login(page);
  for(const route of ['','seasons','athletes','applications','events','matches','rankings','champions','media','clubs','coaches','users','settings']){await page.goto('/admin'+(route?'/'+route:''));await page.locator('.admin-title').waitFor();await audit('admin '+route);}
  for(const [route,button] of [['athletes','Добавить спортсмена'],['events','Создать событие'],['matches','Новый матч'],['media','Создать материал']]){
    await page.goto('/admin/'+route);await page.getByRole('button',{name:button,exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await audit(route+' dialog');
    await page.getByRole('dialog').getByRole('button',{name:'OK',exact:true}).click();await expect(page.locator('.ant-form-item-explain-error').first()).toBeVisible();await audit(route+' errors');
  }
  await page.goto('/admin/applications');await page.getByRole('button',{name:'Рассмотреть',exact:true}).first().click();await audit('application drawer');
  await page.setViewportSize({width:320,height:900});await page.goto('/');await page.getByRole('button',{name:'Открыть меню'}).click();await audit('mobile public drawer');
  await page.goto('/admin');await page.getByRole('button',{name:'Меню администрации'}).click();await audit('mobile admin drawer');
});

test('responsive: navigation, populated forms, tables, modal and drawer at ten widths',async({page})=>{
  const d=data(),rows:any[]=[];await login(page);
  for(const width of widths){
    await page.setViewportSize({width,height:900});const row:any={width,checks:[]};rows.push(row);
    async function layout(name:string){await ready(page);const r=await page.evaluate(()=>{
      const visible=(e:Element)=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden';
      const overlaps:string[]=[];
      for(const parent of document.querySelectorAll('.header .wrap,.header-tools,.admin-header,.filters,.admin-toolbar,.ranking-row,.match')){
        const children=Array.from(parent.children).filter(visible);
        for(let i=0;i<children.length;i++)for(let j=i+1;j<children.length;j++){
          const a=children[i].getBoundingClientRect(),b=children[j].getBoundingClientRect();
          if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>2&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>2)overlaps.push(parent.className+': '+children[i].className+' / '+children[j].className);
        }
      }
      return {overflow:document.documentElement.scrollWidth>innerWidth+1,overlaps};
    });row.checks.push({name,...r});fs.writeFileSync(out+'responsive-detail.json',JSON.stringify(rows,null,2));expect.soft(r.overflow,name+' overflow '+width).toBe(false);expect.soft(r.overlaps,name+' overlaps '+width).toEqual([]);}
    await page.goto('/');await page.locator('main h1').waitFor();await layout('public header');
    if(width<768){await page.getByRole('button',{name:'Открыть меню'}).click();await layout('public drawer');await page.getByRole('dialog').getByRole('link',{name:'Рейтинг',exact:true}).click();}else await page.getByRole('navigation',{name:'Основная навигация'}).getByRole('link',{name:'Рейтинг',exact:true}).click();
    await expect(page).toHaveURL(/\/rankings$/);await expect(page.locator('.ranking-row')).toHaveCount(2);await layout('rankings');
    await page.screenshot({animations:'disabled',path:out+'rankings-'+width+'.png',fullPage:true});
    await page.goto('/admin/seasons');await select(page,'Состав сезона',d.season.name);await expect(page.getByRole('cell',{name:d.athletes.find((a:any)=>a.firstName.startsWith('QAFirst')).firstName+' Wrestler',exact:true})).toBeVisible();await layout('populated season roster form');
    await page.screenshot({animations:'disabled',path:out+'roster-'+width+'.png',fullPage:true});
    const scrollable=page.locator('.ant-table-content');for(let i=0;i<await scrollable.count();i++){const r=await scrollable.nth(i).evaluate(e=>{const needed=e.scrollWidth>e.clientWidth+1;e.scrollLeft=e.scrollWidth;return {needed,moved:e.scrollLeft>0};});if(r.needed)expect.soft(r.moved,'table scroll '+width).toBe(true);}
    await page.goto('/admin/matches');const trigger=page.getByRole('button',{name:'Новый матч',exact:true});await trigger.click();const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();await select(page,'Сезон',d.season.name);await select(page,'Событие',d.event.name);await select(page,'Вес',d.wc.name);await layout('populated match modal');
    await page.screenshot({animations:'disabled',path:out+'match-modal-'+width+'.png',fullPage:true});await dialog.getByRole('button',{name:/Close|Закрыть/,exact:true}).click();await expect(trigger).toBeFocused();
    await page.goto('/admin/applications');await page.getByRole('button',{name:'Рассмотреть',exact:true}).first().click();await expect(page.getByRole('dialog')).toBeVisible();await layout('application drawer');await page.screenshot({animations:'disabled',path:out+'drawer-'+width+'.png',fullPage:true});await page.getByRole('dialog').getByRole('button',{name:/Close|Закрыть/,exact:true}).click();
    if(width<768){await page.getByRole('button',{name:'Меню администрации'}).click();await page.getByRole('dialog').getByRole('menuitem',{name:'Сезоны',exact:true}).click();await expect(page).toHaveURL(/\/admin\/seasons$/);}else{await page.locator('.admin-sidebar').getByRole('menuitem',{name:'Сезоны',exact:true}).click();await expect(page).toHaveURL(/\/admin\/seasons$/);}
    row.navigation='PASS';row.tables='PASS';row.modalFocus='PASS';fs.writeFileSync(out+'responsive-detail.json',JSON.stringify(rows,null,2));
  }
});

test('keyboard: skip link, search focus, modal trap and form errors',async({page})=>{
  await page.goto('/');await expect(page.getByRole('link',{name:'К содержимому',exact:true})).toBeAttached();await page.keyboard.press('Tab');await expect(page.getByRole('link',{name:'К содержимому',exact:true})).toBeFocused();await page.keyboard.press('Enter');await expect(page.locator('#main-content')).toBeFocused();
  await page.getByRole('button',{name:'Открыть поиск'}).click();await expect(page.getByRole('combobox',{name:'Поиск спортсменов, событий, матчей и медиа'})).toBeFocused();
  for(let i=0;i<8;i++){await page.keyboard.press('Tab');expect(await page.evaluate(()=>!!document.activeElement?.closest('[role="dialog"]'))).toBe(true);}
  await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'Открыть поиск'})).toBeFocused();
  await login(page);await page.goto('/admin/matches');const trigger=page.getByRole('button',{name:'Новый матч',exact:true});await trigger.focus();await page.keyboard.press('Enter');await expect(page.getByRole('dialog')).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>!!document.activeElement?.closest('[role="dialog"]'))).toBe(true);
  for(let i=0;i<15;i++){await page.keyboard.press('Tab');expect(await page.evaluate(()=>!!document.activeElement?.closest('[role="dialog"]'))).toBe(true);}
  await page.getByRole('dialog').getByRole('button',{name:'OK',exact:true}).click();await expect(page.locator('[aria-invalid="true"]').first()).toBeVisible();await page.keyboard.press('Escape');await expect(trigger).toBeFocused();
});
