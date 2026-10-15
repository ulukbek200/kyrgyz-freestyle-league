const randomUUID = () => {
	// Use global crypto.randomUUID if available, otherwise fallback to a simple UUIDv4 generator
	if (typeof globalThis !== 'undefined' && (globalThis as any).crypto && typeof (globalThis as any).crypto.randomUUID === 'function')
		return (globalThis as any).crypto.randomUUID();
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
		const r = Math.random() * 16 | 0;
		const v = c === 'x' ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
};
import {test,expect,api,select,drawer,athleteEditor} from './admin-fixture';

test('independent athlete editor: validation, typed affiliations, photo and edit',async({page,request,adminToken})=>{
 const name='Editor-'+randomUUID().slice(0,8),headers={Authorization:`Bearer ${adminToken}`};
 const year=(await (await request.get(api+'/age-reference')).json()).year;
 const weights=await (await request.get(api+'/weight-classes')).json();
 const weight=weights.find((w:any)=>w.ageDivision==='U23'&&w.kilograms===74);
 await athleteEditor(page);
 await expect(drawer(page).getByLabel('Сезон',{exact:true})).toHaveCount(0);
 await expect(drawer(page).getByLabel('Турнир',{exact:true})).toHaveCount(0);
 await drawer(page).getByRole('button',{name:'Сохранить',exact:true}).click();
 await expect(drawer(page).locator('.ant-form-item-explain-error').first()).toBeVisible();
 await page.getByLabel('Имя',{exact:true}).fill(name);await page.getByLabel('Фамилия',{exact:true}).fill('Browser');
 await page.getByLabel('Город',{exact:true}).fill('Бишкек');await page.getByLabel('Дата рождения',{exact:true}).fill(`${year-20}-01-01`);
 await select(page,'Весовая категория',weight.name);
 await page.locator('input[id=clubName]').fill('Клуб '+name);await page.locator('input[id=coachName]').fill('Тренер '+name);
 const upload=page.waitForResponse(r=>r.url().endsWith('/admin/uploads')&&r.request().method()==='POST');
 await drawer(page).locator('input[type=file]').setInputFiles({name:'photo.png',mimeType:'image/png',buffer:(globalThis as any).Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aP9sAAAAASUVORK5CYII=','base64')});
 expect((await upload).status()).toBe(201);
 const saved=page.waitForResponse(r=>r.url().endsWith('/admin/athletes')&&r.request().method()==='POST');
 await drawer(page).getByRole('button',{name:'Сохранить',exact:true}).click();const response=await saved;expect(response.status()).toBe(201);
 const athlete=await response.json();await expect(drawer(page)).toHaveCount(0);
 await page.getByLabel('Поиск спортсмена').fill(name);await expect(page.getByText(name+' Browser',{exact:true}).first()).toBeVisible();
 const data=await (await request.get(api+'/admin/athletes?search='+encodeURIComponent(name),{headers})).json();
 expect(data.data[0]._count.tournamentParticipants).toBe(0);expect(data.data[0]._count.wonMatches).toBe(0);expect(new URL(athlete.imageUrl,api).pathname).toMatch(/^\/uploads\//);
 await page.getByRole('button',{name:`Редактировать ${name} Browser`,exact:true}).click();await expect(page.locator('input[id=clubName]')).toHaveValue('Клуб '+name);
 await page.getByLabel('Город',{exact:true}).fill('Ош');const edited=page.waitForResponse(r=>r.url().endsWith('/admin/athletes/'+athlete.id)&&r.request().method()==='PATCH');
 await drawer(page).getByRole('button',{name:'Сохранить',exact:true}).click();expect((await edited).status()).toBe(200);
});

for(const width of [320,375,390,768,1024,1440])test(`athlete drawer fits ${width}px and closes without saving`,async({page,adminToken})=>{
 void adminToken;await page.setViewportSize({width,height:900});await athleteEditor(page);
 const bounds=await drawer(page).boundingBox();expect(bounds).not.toBeNull();expect(bounds!.width).toBeLessThanOrEqual(width);expect(bounds!.x).toBeGreaterThanOrEqual(-1);
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);expect(overflow).toBe(false);
 await expect(drawer(page).getByRole('button',{name:'Сохранить',exact:true})).toBeVisible();await expect(drawer(page).getByRole('button',{name:'OK',exact:true})).toHaveCount(0);
 await drawer(page).getByRole('button',{name:'Отмена',exact:true}).click();await expect(drawer(page)).toHaveCount(0);
});
