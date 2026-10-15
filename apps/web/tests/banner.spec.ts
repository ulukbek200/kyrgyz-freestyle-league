import {test,expect} from '@playwright/test';

for(const bannerUrl of ['http://','javascript:alert(1)',null])test(`historical banner ${bannerUrl} does not crash homepage`,async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/events/upcoming',route=>route.fulfill({json:{id:'historical',name:'Historical tournament',startsAt:'2027-01-01T10:00:00Z',city:'Bishkek',venue:'Arena',ageDivision:'U23',bannerUrl}}));
 await page.goto('/');const card=page.getByRole('article',{name:'Ближайший турнир'});
 await expect(card.getByRole('heading',{name:'Historical tournament'})).toBeVisible();
 const image=card.locator('img');await expect(image).toHaveAttribute('src','/media/kfl-hero-poster.webp');
 await expect.poll(()=>image.evaluate((el:HTMLImageElement)=>el.complete&&el.naturalWidth>0)).toBe(true);
 expect(errors).toEqual([]);
});

test('broken remote image falls back without breaking event link',async({page})=>{
 await page.route('**/api/events/upcoming',route=>route.fulfill({json:{id:'broken',name:'Broken image tournament',startsAt:'2027-01-01T10:00:00Z',city:'Bishkek',venue:'Arena',bannerUrl:'https://banner.invalid/broken.jpg'}}));
 await page.route('https://banner.invalid/**',route=>route.abort());
 await page.goto('/');const card=page.getByRole('article',{name:'Ближайший турнир'});await card.scrollIntoViewIfNeeded();
 await expect(card.locator('img')).toHaveAttribute('src','/media/kfl-hero-poster.webp');
 await expect(card.getByRole('link')).toHaveAttribute('href','/events/broken');
});
