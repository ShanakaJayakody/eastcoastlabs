import {expect,test,type Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const pageUrl='/orders-workspace.html';
const id='10000000-0000-4000-8000-000000000001';
function visibleList(page:Page){return page.locator(page.viewportSize()!.width<768?'.ow-mobile-list':'.ow-desktop-list');}
async function openFirst(page:Page){const trigger=visibleList(page).getByRole(page.viewportSize()!.width<768?'button':'link',{name:page.viewportSize()!.width<768?'Open order ECL-1048':'ECL-1048',exact:true});await trigger.click();return trigger;}
test.beforeEach(async({page})=>{await page.route('**/*',route=>{const url=new URL(route.request().url());return url.hostname==='127.0.0.1'&&!url.pathname.startsWith('/api/')?route.continue():route.abort();});});
test('keeps shipping and context through the actual drawer',async({page},info)=>{
 await page.goto(`${pageUrl}?status=to_fulfil&shipping=express`);const trigger=await openFirst(page),drawer=page.getByRole('dialog',{name:'Order ECL-1048'});
 await expect(drawer.getByText('Express',{exact:true})).toBeVisible();await expect(drawer.getByText('12 Sample Street',{exact:true})).toBeVisible();await expect(drawer.getByRole('link',{name:'Open full order'})).toHaveAttribute('href',/returnTo=/);
 await page.screenshot({path:info.outputPath('orders-drawer.png')});
 const axe=await new AxeBuilder({page}).include('.ow-drawer').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(axe.violations).toEqual([]);
 await drawer.getByRole('button',{name:'Close order'}).click();await expect(page).toHaveURL(/shipping=express/);await expect(trigger).toBeFocused();await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('fits the real shell, renders one heading and passes scoped accessibility',async({page},info)=>{
 await page.goto(pageUrl);await expect(visibleList(page).getByRole('link',{name:'ECL-1048',exact:true})).toBeVisible();await expect(page.getByRole('heading',{level:1})).toHaveCount(1);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 if(page.viewportSize()!.width===1280){const first=await page.locator('.ow-table tbody tr').first().boundingBox(),sixth=await page.locator('.ow-table tbody tr').nth(5).boundingBox();expect(first!.y).toBeLessThanOrEqual(360);expect(sixth!.y+sixth!.height).toBeLessThanOrEqual(900);}
 const axe=await new AxeBuilder({page}).include('.orders-workspace').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(axe.violations).toEqual([]);await page.screenshot({path:info.outputPath('orders-workspace.png'),fullPage:true});
});
test('filters literal search, changes sort and reports empty results accurately',async({page})=>{
 await page.goto(`${pageUrl}?status=all&shipping=express`);await page.getByRole('searchbox',{name:'Search orders'}).fill('ref(1),20%_');await expect(visibleList(page).getByRole('link',{name:'ECL-1048',exact:true})).toBeVisible();await expect(page).toHaveURL(/q=ref/);
 await page.getByLabel('Sort orders').selectOption('total_cents');await expect(page).toHaveURL(/shipping=express.*sort=total_cents/);await page.getByRole('searchbox').fill('no-such-order');await page.getByRole('searchbox').press('Enter');await expect(page.getByText('No orders match these filters.')).toBeVisible();await page.getByRole('button',{name:'Clear filters',exact:true}).click();await expect(page.getByRole('searchbox')).toHaveValue('');
});
test('reviews payment, protects a draft, and preserves context after success',async({page})=>{
 await page.goto(`${pageUrl}?status=pending`);await visibleList(page).getByRole('link',{name:'ECL-1058',exact:true}).click();const drawer=page.getByRole('dialog');await drawer.getByLabel('Payment reference').fill('BANK-TEST');await page.keyboard.press('Escape');await expect(drawer.getByText('Discard the unsaved payment reference?')).toBeVisible();await drawer.getByRole('button',{name:'Keep editing'}).click();await drawer.getByRole('button',{name:'Review payment'}).click();await drawer.getByRole('button',{name:'Confirm payment',exact:true}).click();await expect(drawer.getByText('Payment recorded. Customer receipt queued.')).toBeVisible();await expect(drawer.getByText('This order no longer matches this view.')).toBeVisible();
});
test('retains failed payments only and builds a selected packing batch',async({page})=>{
 await page.goto(`${pageUrl}?status=pending&fixtureMode=partial`);await visibleList(page).getByLabel('Select ECL-1058',{exact:true}).check();await visibleList(page).getByLabel('Select ECL-1059',{exact:true}).check();await page.getByRole('button',{name:'Confirm 2 payments'}).click();await page.getByRole('dialog').getByRole('button',{name:'Confirm payments'}).click();await expect(page.getByText('Synthetic stock unavailable')).toBeVisible();await expect(visibleList(page).getByLabel('Select ECL-1059',{exact:true})).toBeChecked();await page.getByRole('button',{name:'Confirm 1 payment'}).click();await page.getByRole('dialog').getByRole('button',{name:'Confirm payments'}).click();await expect(page.getByText('Payments confirmed: 1 succeeded · 0 failed')).toBeVisible();await page.getByRole('button',{name:/^To fulfil/}).click();await visibleList(page).getByLabel('Select ECL-1048',{exact:true}).check();await visibleList(page).getByLabel('Select ECL-1049',{exact:true}).check();await expect(page.getByRole('link',{name:'Prepare packing (2)'})).toHaveAttribute('href',new RegExp(`batch=${id}%2C`));
});
test('saves, renames, applies and removes a private view',async({page})=>{
 await page.goto(`${pageUrl}?status=pending&q=private`);await page.getByText('Personal views',{exact:true}).click();await page.getByRole('button',{name:'Save view',exact:true}).click();await page.getByLabel('View name').fill('My payments');await page.getByRole('button',{name:'Save',exact:true}).click();await page.getByLabel('Saved views').selectOption({label:'My payments'});await expect(page.getByRole('searchbox')).toHaveValue('');await page.getByRole('button',{name:'Rename saved view'}).click();await page.getByLabel('View name').fill('Transfers');await page.getByRole('button',{name:'Save',exact:true}).click();await expect(page.getByLabel('Saved views').getByRole('option',{name:'Transfers'})).toHaveCount(1);await page.getByRole('button',{name:'Delete saved view'}).click();await page.getByRole('dialog').getByRole('button',{name:'Delete view'}).click();await expect(page.getByLabel('Saved views').getByRole('option',{name:'Transfers'})).toHaveCount(0);
});
test('survives denied storage and preview errors',async({page})=>{
 await page.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw new Error('Synthetic denied storage');}});});await page.goto(`${pageUrl}?fixtureMode=error`);await page.getByLabel('Row density').selectOption('compact');await expect(page.getByText('Preferences apply for this visit. Browser storage is unavailable.')).toBeVisible();await openFirst(page);await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Unable to load order');await page.getByRole('dialog').getByRole('button',{name:'Retry'}).click();await expect(page.getByRole('dialog',{name:'Order ECL-1048'})).toBeVisible();
});
test('handles extra widths, reduced motion and zoom reflow',async({page},info)=>{
 test.skip(info.project.name!=='desktop','Extra widths run once');await page.emulateMedia({reducedMotion:'reduce'});await page.goto(`${pageUrl}?status=all`);
 for(const width of [768,1440]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath(`orders-${width}.png`),fullPage:true});}
 // CSS zoom exercises a 200% content reflow; native browser zoom remains a manual review gate.
 await page.setViewportSize({width:1280,height:900});await page.evaluate(()=>{document.documentElement.style.zoom='2';});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('keeps sticky bulk actions clear of sortable headers',async({page},info)=>{
 test.skip(info.project.name!=='desktop','Desktop table check');await page.goto(pageUrl);await page.getByLabel('Select all orders on this page').filter({visible:true}).check();await page.evaluate(()=>window.scrollTo(0,500));const bar=await page.locator('.ow-bulk').boundingBox(),header=await page.locator('.ow-table thead th').first().boundingBox();expect(header!.y).toBeGreaterThanOrEqual(bar!.y+bar!.height);await expect(page.getByRole('button',{name:'Sort by Total'})).toBeVisible();
});
test('navigates away from delayed previews and restores fixture history',async({page})=>{
 await page.goto(`${pageUrl}?fixtureMode=race`);await openFirst(page);await page.getByRole('dialog').getByRole('button',{name:'Next order'}).click();await expect(page.getByRole('dialog',{name:'Order ECL-1049'})).toBeVisible();await page.goBack();await expect(page.getByRole('dialog')).toHaveCount(0);await page.goForward();await expect(page.getByRole('dialog',{name:'Order ECL-1049'})).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
});
