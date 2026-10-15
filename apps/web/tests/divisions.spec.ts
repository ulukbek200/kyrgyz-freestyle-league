import {test,expect,api,athleteEditor,drawer} from './admin-fixture';

test('profile division follows birth year and clears incompatible weight',async({page,request,adminToken})=>{
 void adminToken;const year=(await (await request.get(api+'/age-reference')).json()).year;
 await athleteEditor(page);await page.getByLabel('Дата рождения',{exact:true}).fill(`${year-17}-12-31`);
 await expect(drawer(page).locator('.ant-select-selection-item').filter({hasText:'U17'})).toHaveCount(1);
 await page.getByLabel('Дата рождения',{exact:true}).fill(`${year-18}-12-31`);
 await expect(drawer(page).locator('.ant-select-selection-item').filter({hasText:'U23'})).toHaveCount(1);
 await page.getByLabel('Дата рождения',{exact:true}).fill(`${year-24}-01-01`);
 await expect(drawer(page).getByText(/участие в U17\/U23 в текущем году недоступно/)).toBeVisible();
});

test('public application does not require season and accepts typed club/coach',async({page})=>{
 await page.goto('/apply');await expect(page.getByLabel('Сезон',{exact:true})).toHaveCount(0);
 await expect(page.locator('input[id$="clubName"]')).toBeVisible();await expect(page.locator('input[id$="coachName"]')).toBeVisible();
 await page.locator('input[id$="clubName"]').fill('Мой клуб');await page.locator('input[id$="coachName"]').fill('Мой тренер');
});
