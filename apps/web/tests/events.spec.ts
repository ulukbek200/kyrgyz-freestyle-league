import {test,expect} from '@playwright/test';

// Synthetic responses are restricted to tests, never seeded into the working database.
const weights=[{weightClassId:'w45',weightClass:{name:'45 кг'}},{weightClassId:'w60',weightClass:{name:'60 кг'}}];
const event={id:'events-ui',name:'UI tournament',city:'Нарын',venue:'Арена',startsAt:'2026-10-17T10:00:00Z',status:'PLANNED',ageDivision:'U17',bannerUrl:'http://',weightClasses:weights,participants:[]};
test('events filters, redirects, safe banner and category survives all tabs and reload',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/events',r=>r.fulfill({json:[event,{...event,id:'done',name:'Completed tournament',status:'COMPLETED'}]}));
 await page.route('**/api/events/events-ui',r=>r.fulfill({json:event}));
 await page.route('**/api/events/events-ui/competition/*',r=>r.fulfill({json:null}));
 await page.route('**/api/matches?**',r=>r.fulfill({json:{data:[],total:0}}));
 await page.goto('/matches?status=UPCOMING');await expect(page).toHaveURL(/\/events\?status=PLANNED$/);
 await expect(page.getByRole('heading',{name:'СОБЫТИЯ',exact:true})).toBeVisible();
 await expect(page.locator('.event-feature')).toHaveCount(1);await expect(page.locator('.event-cover')).toHaveAttribute('src','/media/kfl-hero-poster.webp');
 await page.getByRole('button',{name:'Все',exact:true}).click();await expect(page.locator('.event-feature')).toHaveCount(2);
 await page.getByRole('article',{name:event.name,exact:true}).getByRole('link').click();
 await page.locator('.event-category .ant-select-selector').click();await page.locator('.ant-select-dropdown:visible').getByText('60 кг',{exact:true}).click();
 for(const name of ['Участники','Группы и турнирные таблицы','Расписание и схватки','Плей-офф','Результаты','Обзор']){await page.getByRole('tab',{name,exact:true}).click();await expect(page).toHaveURL(/weight=w60/);await expect(page.locator('.event-category .ant-select-selection-item')).toHaveText('60 кг');}
 await page.reload();await expect(page.locator('.event-category .ant-select-selection-item')).toHaveText('60 кг');
 await page.getByRole('tab',{name:'Расписание и схватки',exact:true}).click();
 for(const [name,label] of [['Тур','Тур 6'],['Группа','Группа A'],['Статус схватки','Предстоящие']]){await page.locator('.ant-select').filter({has:page.getByRole('combobox',{name,exact:true})}).locator('.ant-select-selector').click();await page.locator('.ant-select-dropdown:visible').getByText(label,{exact:true}).click();}
 await expect.poll(()=>page.url()).toContain('round=6');
 await expect.poll(()=>page.url()).toContain('group=A');
 await page.goto('/matches?eventId=events-ui');await expect(page).toHaveURL(/events\/events-ui\?tab=schedule$/);
 expect(errors).toEqual([]);
});

test('events loading, empty and API failure are explicit',async({page})=>{
 let release!:()=>void;const pending=new Promise<void>(r=>release=r);
 await page.route('**/api/events',async r=>{await pending;await r.fulfill({json:[]});});
 await page.goto('/events');await expect(page.getByRole('status')).toContainText('Загрузка');release();await expect(page.getByText('Пока нет данных для выбранных условий.')).toBeVisible();
 await page.unroute('**/api/events');await page.route('**/api/events',r=>r.fulfill({status:500,json:{error:'Server error'}}));await page.reload();await expect(page.getByRole('alert')).toContainText('Не удалось загрузить данные');await expect(page.getByRole('button',{name:'Повторить'})).toBeVisible();
});

for(const width of [320,375,390,768,1024])test(`event tabs fit ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});
 await page.route('**/api/events/events-ui',r=>r.fulfill({json:event}));await page.route('**/api/events/events-ui/competition/*',r=>r.fulfill({json:null}));await page.route('**/api/matches?**',r=>r.fulfill({json:{data:[],total:0}}));
 for(const tab of ['overview','participants','standings','schedule','playoff','results']){await page.goto('/events/events-ui?tab='+tab);await expect(page.getByRole('heading',{name:event.name,exact:true})).toBeVisible();await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);}
});
