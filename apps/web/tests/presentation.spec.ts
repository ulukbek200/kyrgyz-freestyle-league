import {randomUUID} from 'node:crypto';
import {test,expect,api,athleteEditor,drawer,select} from './admin-fixture';

test('presentation: athlete UI to tournament, registration, match, result and public ranking',async({page,request,adminToken})=>{
 test.setTimeout(120000);
 const suffix=randomUUID().slice(0,8),names=['Red'+suffix,'Blue'+suffix],headers={Authorization:'Bearer '+adminToken};
 const year=(await(await request.get(api+'/age-reference')).json()).year;
 const weight=(await(await request.get(api+'/weight-classes')).json()).find((w:any)=>w.ageDivision==='U23'&&w.kilograms===74);
 const athletes:any[]=[];
 for(const name of names){
  await athleteEditor(page);await page.getByLabel('Имя',{exact:true}).fill(name);await page.getByLabel('Фамилия',{exact:true}).fill('Presentation');await page.getByLabel('Город',{exact:true}).fill('Бишкек');await page.getByLabel('Дата рождения',{exact:true}).fill(`${year-20}-01-01`);await select(page,'Весовая категория',weight.name);
  const saved=page.waitForResponse(r=>r.url().endsWith('/admin/athletes')&&r.request().method()==='POST');await drawer(page).getByRole('button',{name:'Сохранить',exact:true}).click();const response=await saved;expect(response.status()).toBe(201);athletes.push(await response.json());await expect(drawer(page)).toHaveCount(0);
 }
 await page.goto('/admin/events');await page.getByRole('button',{name:'Создать турнир',exact:true}).click();await page.getByLabel('Название турнира',{exact:true}).fill('Presentation '+suffix);await page.getByLabel('Дата и время',{exact:true}).fill(`${year}-10-17T12:00`);await select(page,'Дивизион','U23');await page.getByLabel('Город',{exact:true}).fill('Бишкек');await page.getByLabel('Место проведения',{exact:true}).fill('Арена');await select(page,'Весовые категории',weight.name);await page.locator('textarea[id=description]').click();
 const created=page.waitForResponse(r=>r.url().endsWith('/admin/events')&&r.request().method()==='POST');await drawer(page).getByRole('button',{name:'Сохранить',exact:true}).click();const event=await(await created).json();await expect(page).toHaveURL(new RegExp('/admin/events/'+event.id));
 await page.getByRole('tab',{name:'Участники',exact:true}).click();
 for(const athlete of athletes){await page.getByRole('button',{name:'Добавить участника',exact:true}).click();await page.getByLabel('Поиск участника').fill(athlete.firstName+' '+athlete.lastName);await drawer(page).getByRole('row').filter({hasText:athlete.firstName}).getByRole('radio').check();const registered=page.waitForResponse(r=>r.url().endsWith('/participants')&&r.request().method()==='POST');await drawer(page).getByRole('button',{name:'Сохранить',exact:true}).click();expect((await registered).status()).toBe(201);await expect(drawer(page)).toHaveCount(0);}
 await page.getByRole('tab',{name:'Схватки',exact:true}).click();await page.getByRole('button',{name:'Создать схватку',exact:true}).click();await select(page,'Весовая категория',weight.name);await select(page,'Красный угол',names[0]);await select(page,'Синий угол',names[1]);
 const paired=page.waitForResponse(r=>r.url().endsWith('/admin/matches')&&r.request().method()==='POST');await drawer(page).getByRole('button',{name:'Сохранить',exact:true}).click();const pairResponse=await paired;expect(pairResponse.status()).toBe(201);const match=await pairResponse.json();await expect(drawer(page)).toHaveCount(0);
 await page.getByRole('button',{name:'Ввести результат',exact:true}).click();await page.getByLabel('Баллы красного',{exact:true}).fill('4');await page.getByLabel('Баллы синего',{exact:true}).fill('2');await select(page,'Победитель',names[0]);await select(page,'Метод победы','Туше');
 const scored=page.waitForResponse(r=>r.url().endsWith('/result')&&r.request().method()==='POST');await drawer(page).getByRole('button',{name:'Сохранить',exact:true}).click();expect((await scored).status()).toBe(200);await expect(drawer(page)).toHaveCount(0);
 const standings=await(await request.get(api+'/rankings?weightClassId='+weight.id)).json();const rank=standings.find((r:any)=>r.athlete.id===athletes[0].id);expect(rank.wins).toBe(1);expect(rank.points).toBeGreaterThan(0);
 await page.goto('/events');await page.getByRole('article',{name:'Presentation '+suffix,exact:true}).getByRole('link').click();await expect(page.getByRole('heading',{name:'Presentation '+suffix})).toBeVisible();await page.getByRole('tab',{name:'Результаты',exact:true}).click();await expect(page.locator('a[href="/matches/'+match.id+'"]')).toContainText('4 : 2');
 await page.goto('/athletes/'+athletes[0].id);await expect(page.getByText('ПОБЕДА',{exact:true})).toBeVisible();await expect(page.locator('a[href="/events/'+event.id+'"]')).toContainText('Presentation '+suffix);
 await page.goto('/rankings');await select(page,'Дивизион рейтинга','U23');await expect(page.getByRole('combobox',{name:'Дивизион рейтинга'})).toHaveAttribute('aria-expanded','false');await page.locator('.filters .ant-select').nth(1).click();await page.locator('.ant-select-dropdown:visible .ant-select-item-option').filter({hasText:weight.name}).click();await expect(page.locator('a[href="/athletes/'+athletes[0].id+'"]')).toContainText(names[0]);
 expect((await request.get(api+'/admin/events/'+event.id,{headers})).status()).toBe(200);
});

for(const width of [320,375,390,768,1024])test(`public presentation pages fit ${width}px`,async({page,request})=>{
 test.setTimeout(120000);await page.setViewportSize({width,height:900});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const athlete=(await(await request.get(api+'/athletes?limit=1')).json()).data[0],event=(await(await request.get(api+'/events')).json())[0],match=(await(await request.get(api+'/matches?limit=1')).json()).data[0];
 for(const path of ['/','/about','/athletes','/rankings','/matches','/champions','/events','/media','/apply',...(athlete?['/athletes/'+athlete.id]:[]),...(event?['/events/'+event.id]:[]),...(match?['/matches/'+match.id]:[])]){await page.goto(path);await expect(page.locator('h1')).toBeVisible();await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),{message:path+' horizontal overflow'}).toBeLessThanOrEqual(1);}
 expect(errors).toEqual([]);
});

for(const width of [320,375,390,768,1024])test(`admin sections fit ${width}px`,async({page,adminToken})=>{
 void adminToken;test.setTimeout(120000);await page.setViewportSize({width,height:900});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 for(const path of ['','/athletes','/events','/rankings','/champions','/media','/applications','/clubs','/coaches','/users','/settings']){await page.goto('/admin'+path);await expect(page.locator('.kfl-page h1')).toBeVisible();await expect(page.locator('.kfl-page .ant-spin-spinning')).toHaveCount(0);await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),{message:'/admin'+path+' overflow'}).toBeLessThanOrEqual(1);}
 expect(errors).toEqual([]);
});

test('news UI create, publish, edit and public view',async({page,adminToken})=>{
 void adminToken;
 const name='News '+randomUUID().slice(0,8);await page.goto('/admin/media');await page.getByRole('button',{name:'Создать публикацию',exact:true}).click();await page.getByLabel('Заголовок',{exact:true}).fill(name);await page.getByLabel('Короткий адрес',{exact:true}).fill(name.toLowerCase().replace(' ','-'));await page.getByLabel('Рубрика',{exact:true}).fill('Новости');await page.getByLabel('Текст публикации',{exact:true}).fill('Проверка публикации KFL.');await page.getByRole('switch',{name:'Опубликовать на сайте'}).click();
 const saved=page.waitForResponse(r=>r.url().endsWith('/admin/media')&&r.request().method()==='POST');await drawer(page).getByRole('button',{name:'Сохранить',exact:true}).click();const response=await saved;expect(response.status()).toBe(201);const post=await response.json();await expect(drawer(page)).toHaveCount(0);
 const card=page.locator('.kfl-media-card').filter({hasText:name});await card.getByRole('button',{name:'Редактировать',exact:true}).click();await page.getByLabel('Текст публикации',{exact:true}).fill('Обновлённая публикация KFL.');const edited=page.waitForResponse(r=>r.url().endsWith('/admin/media/'+post.id)&&r.request().method()==='PATCH');await drawer(page).getByRole('button',{name:'Сохранить',exact:true}).click();expect((await edited).status()).toBe(200);
 await page.goto('/media');await page.getByRole('heading',{name,exact:true}).click();await expect(page).toHaveURL(new RegExp('/media/'+post.id));await expect(page.getByText('Обновлённая публикация KFL.',{exact:true})).toBeVisible();
});

test('public application validates consent and submits cleared optional URLs once',async({page,request})=>{
 const year=(await(await request.get(api+'/age-reference')).json()).year;
 await page.goto('/apply');for(const [label,value] of [['Имя','Applicant'],['Фамилия','Presentation'],['Город','Бишкек'],['Страна','Kyrgyzstan'],['Телефон','0700123456'],['Email','applicant-'+randomUUID().slice(0,8)+'@example.invalid'],['Вес, кг','74']])await page.getByLabel(label,{exact:true}).fill(value);
 await page.getByLabel('Дата рождения',{exact:true}).fill(`${year-20}-01-01`);await select(page,'Весовая категория','74 кг');await page.locator('input[id=videoUrl]').fill('https://example.com/video');await page.locator('input[id=videoUrl]').clear();
 await page.getByRole('button',{name:'Отправить заявку'}).click();await expect(page.getByText('Необходимо согласие',{exact:true})).toBeVisible();await page.getByRole('checkbox').check();
 let submits=0;page.on('request',r=>{if(r.url().endsWith('/applications')&&r.method()==='POST')submits++;});const response=page.waitForResponse(r=>r.url().endsWith('/applications')&&r.request().method()==='POST');await page.getByRole('button',{name:'Отправить заявку'}).click();expect((await response).status()).toBe(201);await expect(page.getByRole('heading',{name:'ЗАЯВКА ПРИНЯТА'})).toBeVisible();expect(submits).toBe(1);
});

test('public errors and legacy localhost uploads are handled explicitly',async({page})=>{
 await page.route('**/api/athletes?**',route=>route.fulfill({status:500,json:{error:'Invalid request'}}));await page.goto('/athletes');await expect(page.getByRole('alert')).toContainText('Не удалось загрузить');await expect(page.getByRole('button',{name:'Повторить'})).toBeVisible();
 await page.unroute('**/api/athletes?**');await page.route('**/api/athletes?**',route=>route.fulfill({json:{data:[{id:'legacy',firstName:'Legacy',lastName:'Photo',city:'Bishkek',country:'KG',imageUrl:'http://localhost:4401/uploads/abc-123.png'}],total:1}}));
 await page.goto('/athletes');await expect(page.locator('.avatar img')).toHaveAttribute('src','http://127.0.0.1:4400/uploads/abc-123.png');
});
