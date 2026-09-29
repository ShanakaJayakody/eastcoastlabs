import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async({page})=>{
 await page.route('**/*',route=>{
  const url=new URL(route.request().url());
  return url.hostname==='127.0.0.1'||url.protocol==='data:'?route.continue():route.abort();
 });
 await page.goto('/navy.html');
});

test('navy page fits the viewport and keeps product, report and brand links accessible',async({page})=>{
 await expect(page.getByRole('heading',{level:1})).toHaveText(/Research Peptides.*You Can Trust.*Quality You Can.*Verify/);
 // Font loading is asynchronous in this client-rendered fixture. Measure the
 // finished layout; the separate blocked-font case verifies its fallback too.
 await page.evaluate(()=>document.fonts.ready.then(()=>undefined));
 const layout=await page.evaluate(()=>({fits:document.documentElement.scrollWidth<=innerWidth,viewport:innerWidth,width:document.documentElement.scrollWidth,fontStatus:document.fonts.status,wide:[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth&&!e.closest('.rb-hero-art')).map(e=>({tag:e.tagName,className:e.className,right:e.getBoundingClientRect().right})).slice(0,12),widthAfterMeasurement:document.documentElement.scrollWidth}));
 expect(layout.fits,JSON.stringify(layout)).toBe(true);
 await expect(page.locator('.rb-header img')).toHaveAttribute('src','/logo.png');
 await expect(page.locator('.rb-footer img')).toHaveAttribute('src','/logo.png');
 await expect(page.getByRole('link',{name:'Retatrutide',exact:true})).toHaveAttribute('href','/product/retatrutide?rebrand=v2');
 await page.getByRole('button',{name:'Metabolic research',exact:true}).click();
 await expect(page.getByRole('link',{name:'Retatrutide',exact:true})).toBeVisible();
 await expect(page.getByRole('link',{name:'GHK-Cu',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Popular peptides',exact:true}).click();
 await expect(page.getByRole('link',{name:'GHK-Cu',exact:true})).toBeVisible();
 const result=await new AxeBuilder({page}).include('.rebrand').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
 expect(result.violations.filter(v=>['serious','critical'].includes(v.impact??''))).toEqual([]);
});

test('navy layout fits before the brand font is available',async({page})=>{
 await page.route('**/*.woff2',route=>route.abort());
 await page.reload();
 await expect(page.getByRole('heading',{level:1})).toBeVisible();
 await page.evaluate(()=>document.fonts.ready.then(()=>undefined));
 const layout=await page.evaluate(()=>({width:document.documentElement.scrollWidth,viewport:innerWidth,wide:[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth&&!e.closest('.rb-hero-art')).map(e=>({tag:e.tagName,className:e.className,right:e.getBoundingClientRect().right}))}));
 expect(layout.width,JSON.stringify(layout)).toBeLessThanOrEqual(layout.viewport);
});

test('tablet hero keeps its copy above the vials',async({page},testInfo)=>{
 test.skip(testInfo.project.name!=='desktop','Tablet widths are checked once.');
 for(const width of [770,900,1100]){
  await page.setViewportSize({width,height:1000});
  await page.evaluate(()=>document.fonts.ready.then(()=>undefined));
  const copy=await page.locator('.rb-hero-copy').boundingBox();
  const art=await page.locator('.rb-hero-art').boundingBox();
  // The upper 30% of the photograph is empty background, above the vial caps.
  expect(copy!.y+copy!.height,`Hero copy at ${width}px`).toBeLessThanOrEqual(art!.y+art!.height*.3);
 }
});

test('navy cart keeps its compact heading and readable primary action',async({page})=>{
 await page.getByRole('button',{name:'Open shopping bag, 0 items',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Shopping cart'});
 await expect(dialog).toBeVisible();
 expect(await dialog.getByRole('heading',{name:'YOUR CART'}).evaluate(e=>parseFloat(getComputedStyle(e).fontSize))).toBeLessThanOrEqual(16);
 const result=await new AxeBuilder({page}).include('[role="dialog"]').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
 expect(result.violations.filter(v=>['serious','critical'].includes(v.impact??''))).toEqual([]);
 await page.keyboard.press('Escape');
 await expect(dialog).toBeHidden();
 await expect(page.getByRole('button',{name:'Open shopping bag, 0 items',exact:true})).toBeFocused();
});

test('navy mobile menu traps focus and closes after navigation',async({page},testInfo)=>{
 test.skip(testInfo.project.name==='desktop','Desktop has inline navigation.');
 const opener=page.getByRole('button',{name:'Open menu',exact:true});
 await opener.click();
 const dialog=page.getByRole('dialog',{name:'Navigation menu'});
 await expect(dialog).toBeVisible();
 for(let i=0;i<10;i++){
  await page.keyboard.press('Tab');
  expect(await dialog.evaluate(e=>e.contains(document.activeElement))).toBe(true);
 }
 await page.keyboard.press('Escape');
 await expect(dialog).toBeHidden();
 await expect(opener).toBeFocused();
 await opener.click();
 await dialog.getByRole('link',{name:'Research peptides',exact:true}).click();
 await expect(dialog).toBeHidden();
 expect(await page.evaluate(()=>document.body.style.overflow)).not.toBe('hidden');
});
