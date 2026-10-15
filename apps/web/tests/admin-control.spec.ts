import {randomUUID} from 'node:crypto';
import {test,expect,api,select,drawer} from './admin-fixture';

test('tournament creation, participant search, removal and profile return flow',async({page,request,adminToken})=>{
 const name='Tournament-'+randomUUID().slice(0,8),headers={Authorization:`Bearer ${adminToken}`};
 const year=(await (await request.get(api+'/age-reference')).json()).year;
 const weights=await (await request.get(api+'/weight-classes')).json(),weight=weights.find((w:any)=>w.ageDivision==='U23'&&w.kilograms===74);
 const athleteResponse=await request.post(api+'/admin/athletes',{headers,data:{firstName:name,lastName:'Participant',city:'Бишкек',dateOfBirth:`${year-20}-01-01`,weightClassId:weight.id}});expect(athleteResponse.status()).toBe(201);
 const athlete=await athleteResponse.json();
 await page.goto('/admin/events');await expect(page.locator('a[href="/admin/seasons"]')).toHaveCount(1);await expect(page.locator('a[href="/admin/matches"]')).toHaveCount(0);
 await page.getByRole('button',{name:'Создать турнир',exact:true}).click();
 await page.getByLabel('Название турнира',{exact:true}).fill(name);await page.getByLabel('Дата и время',{exact:true}).fill(`${year}-08-01T10:00`);
 await select(page,'Дивизион','U23');await page.getByLabel('Город',{exact:true}).fill('Бишкек');await page.getByLabel('Место проведения',{exact:true}).fill('Арена');
 await select(page,'Весовые категории',weight.name);await page.locator('textarea[id=description]').click();
 const created=page.waitForResponse(r=>r.url().endsWith('/admin/events')&&r.request().method()==='POST');await drawer(page).getByRole('button',{name:'Сохранить',exact:true}).click();
 const response=await created;expect(response.status()).toBe(201);const event=await response.json();await expect(page).toHaveURL(new RegExp('/admin/events/'+event.id));
 for(const tab of ['Обзор','Участники','Схватки','Результаты'])await expect(page.getByRole('tab',{name:tab,exact:true})).toBeVisible();
 await page.getByRole('tab',{name:'Участники',exact:true}).click();await page.getByRole('button',{name:'Добавить участника',exact:true}).click();
 await page.getByLabel('Поиск участника').fill(name);const row=drawer(page).getByRole('row').filter({hasText:name});await row.getByRole('radio').check();
 const registered=page.waitForResponse(r=>r.url().endsWith('/participants')&&r.request().method()==='POST');await drawer(page).getByRole('button',{name:'Сохранить',exact:true}).click();expect((await registered).status()).toBe(201);
 await expect(drawer(page)).toHaveCount(0);await expect(page.getByText(name+' Participant',{exact:true}).first()).toBeVisible();
 const removed=page.waitForResponse(r=>r.url().endsWith('/participants/'+athlete.id)&&r.request().method()==='DELETE');
 await page.getByRole('button',{name:'Убрать',exact:true}).click();await page.locator('.ant-popconfirm').getByRole('button',{name:/OK|Да/}).click();expect((await removed).status()).toBe(200);
 const registry=await (await request.get(api+'/admin/athletes?search='+name,{headers})).json();expect(registry.data.some((a:any)=>a.id===athlete.id)).toBe(true);
 await page.getByRole('button',{name:'Добавить участника',exact:true}).click();await page.getByRole('link',{name:/Нет спортсмена в KFL/}).click();
 await expect(page).toHaveURL(/\/admin\/athletes\?.*returnTo=/);await expect(page.getByRole('button',{name:'Выбрать U23',exact:true})).toBeVisible();
});

for(const [path,title] of [['clubs','Добавить клуб'],['coaches','Добавить тренера']])test(`${title}: shared drawer remains connected`,async({page,adminToken})=>{
 void adminToken;await page.goto('/admin/'+path);await page.getByRole('button',{name:title,exact:true}).click();await expect(drawer(page)).toBeVisible();
 await drawer(page).getByRole('button',{name:'Отмена',exact:true}).click();await expect(drawer(page)).toHaveCount(0);
});
