import {randomUUID} from 'node:crypto';
import {test,expect,api,drawer,select} from './admin-fixture';

test('administrator creates registrar; registrar uploads and creates, cannot administer, logs out',async({page,request,adminToken})=>{
 test.setTimeout(90000);
 const email='registrar-'+randomUUID()+'@example.invalid',password=randomUUID();
 await page.goto('/admin/users');await page.getByRole('button',{name:'Добавить пользователя',exact:true}).click();
 await page.getByLabel('Email',{exact:true}).fill(email);await select(page,'Роль','REGISTRAR');await page.getByLabel('Пароль',{exact:true}).fill(password);
 const response=page.waitForResponse(r=>r.url().endsWith('/admin/users')&&r.request().method()==='POST');await drawer(page).getByRole('button',{name:'Сохранить',exact:true}).click();expect((await response).status()).toBe(201);const account=await(await response).json();await expect(drawer(page)).toHaveCount(0);
 // A separate context must log in through the real login form, without admin fixture injection.
 const context=await page.context().browser()!.newContext({baseURL:'http://127.0.0.1:5175'}),registrar=await context.newPage();
 try{
 await registrar.goto('/admin');await registrar.getByLabel('Email',{exact:true}).fill(email);await registrar.getByLabel('Пароль',{exact:true}).fill(password);await registrar.getByRole('button',{name:'Войти в центр управления'}).click();await expect(registrar.getByRole('heading',{name:'Регистрация спортсменов.',exact:true})).toBeVisible();
 await expect(registrar.getByRole('link',{name:'Пользователи',exact:true})).toHaveCount(0);await registrar.reload();await expect(registrar.getByRole('heading',{name:'Регистрация спортсменов.',exact:true})).toBeVisible();
 await registrar.setViewportSize({width:375,height:900});await registrar.getByRole('button',{name:'Добавить спортсмена',exact:true}).click();
 const year=(await(await request.get(api+'/age-reference')).json()).year;
 for(const [label,value] of [['Имя','Registrar'],['Фамилия','Created'],['Город','Бишкек']])await registrar.getByLabel(label,{exact:true}).fill(value);
 await registrar.getByLabel('Дата рождения',{exact:true}).fill(`${year-20}-01-01`);await select(registrar,'Весовая категория','74 кг');
 const uploaded=registrar.waitForResponse(r=>r.url().endsWith('/admin/uploads')&&r.request().method()==='POST');
 await registrar.locator('input[type=file]').setInputFiles({name:'photo.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j7U8AAAAASUVORK5CYII=','base64')});expect((await uploaded).status()).toBe(201);
 const saved=registrar.waitForResponse(r=>r.url().endsWith('/admin/athletes')&&r.request().method()==='POST');await drawer(registrar).getByRole('button',{name:'Сохранить',exact:true}).click();expect((await saved).status()).toBe(201);const athlete=await(await saved).json();expect(athlete.imageUrl).toMatch(/^\/uploads\//);await expect(registrar.getByText('Спортсмен Registrar Created зарегистрирован',{exact:true})).toBeVisible();
 await expect.poll(()=>registrar.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 await registrar.screenshot({path:'../../.local/team-stage1/registrar-375.png',fullPage:true});
 const token=await registrar.evaluate(()=>localStorage.getItem('nwl-token'));
 for(const path of ['/admin/users','/admin/events','/admin/rankings/recalculate','/admin/matches/forbidden/result'])expect((await request.post(api+path,{headers:{Authorization:'Bearer '+token},data:{}})).status()).toBe(403);
 await registrar.goto('/admin/users');await expect(registrar.getByText('403 — Доступ к этому разделу запрещён')).toBeVisible();await registrar.getByRole('link',{name:'К регистрации спортсменов'}).click();
 await registrar.getByRole('button',{name:'Выйти',exact:true}).click();await expect(registrar.getByRole('heading',{name:'Вход в систему',exact:true})).toBeVisible();expect(await registrar.evaluate(()=>localStorage.getItem('nwl-token'))).toBeNull();
 await registrar.getByLabel('Email',{exact:true}).fill(email);await registrar.getByLabel('Пароль',{exact:true}).fill(password);await registrar.getByRole('button',{name:'Войти в центр управления'}).click();await expect(registrar.getByRole('heading',{name:'Регистрация спортсменов.',exact:true})).toBeVisible();
 // Changes to the role/session must also affect a still-open registrar session.
 expect((await request.patch(api+'/admin/users/'+account.id,{headers:{Authorization:'Bearer '+adminToken},data:{isBlocked:true}})).status()).toBe(200);
 await registrar.reload();await expect(registrar.getByRole('heading',{name:'Вход в систему',exact:true})).toBeVisible();
 }finally{await context.close();}
});
