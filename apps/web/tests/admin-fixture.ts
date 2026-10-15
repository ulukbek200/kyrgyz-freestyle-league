import {test as base,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
export const api='http://127.0.0.1:4400/api';
export const test=base.extend<{adminToken:string}>({adminToken:async({request,page},use)=>{
 const credentials=JSON.parse(readFileSync(new URL('../../../.local/browser-admin.json',import.meta.url),'utf8'));
 const response=await request.post(api+'/auth/login',{data:credentials});expect(response.status()).toBe(200);
 const token=(await response.json()).token;
 await page.addInitScript(value=>localStorage.setItem('nwl-token',value),token);await use(token);
},page:async({page},use)=>{await use(page);}});
export {expect};
export async function select(page:Page,label:string,text:string){
 const input=page.getByLabel(label,{exact:true}).and(page.getByRole('combobox'));
 await page.locator('.ant-select').filter({has:input}).locator('.ant-select-selector').click({timeout:10000});
 await expect(input).toHaveAttribute('aria-expanded','true');
 const listId=await input.getAttribute('aria-controls');expect(listId).toBeTruthy();
 await page.locator('.ant-select-dropdown').filter({has:page.locator('[id="'+listId+'"]')}).locator('.ant-select-item-option').filter({hasText:text}).first().click({timeout:10000});
}
export const drawer=(page:Page)=>page.getByRole('dialog').filter({hasNot:page.getByRole('button',{name:'Выбрать U23',exact:true})});
export async function athleteEditor(page:Page){
 await page.goto('/admin/athletes');await page.getByRole('button',{name:'Добавить спортсмена',exact:true}).click();
 await page.getByRole('button',{name:'Выбрать U23',exact:true}).click();await expect(page.getByRole('dialog',{name:'В какой дивизион добавить спортсмена?'})).toHaveCount(0);await expect(drawer(page)).toBeVisible();
}
