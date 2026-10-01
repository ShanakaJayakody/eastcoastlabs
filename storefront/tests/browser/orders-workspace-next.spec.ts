/** Real App Router checks. All IDs must belong to a disposable synthetic environment. */
import {test,expect} from '@playwright/test';
const id=process.env.ECL_ADMIN_ORDERS_TEST_ORDER_ID;
const batchIds=process.env.ECL_ADMIN_ORDERS_TEST_BATCH_IDS?.split(',')??[];
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
test.beforeEach(()=>{test.skip(!id||!uuid.test(id),'Supply ECL_ADMIN_ORDERS_TEST_ORDER_ID for a synthetic pending order.');});
test('direct drawer, authenticated preview and full-order return context',async({page})=>{
 await page.goto(`/admin/orders?status=all&order=${id}`);await expect(page.getByRole('dialog')).toBeVisible();
 const response=await page.request.get(`/admin/orders/${id}/preview`);expect(response.status()).toBe(200);expect(response.headers()['cache-control']).toBe('private, no-store');expect((await response.json()).facts.id).toBe(id);
 await page.getByRole('dialog').getByRole('link',{name:'Open full order'}).click();await expect(page).toHaveURL(new RegExp(`/orders/${id}\\?returnTo=`));await page.getByRole('link',{name:'Back to orders'}).click();await expect(page).toHaveURL(/\/admin\/orders\?status=all$/);
});
test('opening pushes history; Back closes; Forward restores; search replaces',async({page})=>{
 const preview=await (await page.request.get(`/admin/orders/${id}/preview`)).json();
 await page.goto(`/admin/orders?status=all&q=${encodeURIComponent(preview.order.order_number)}`);
 await page.locator('.ow-desktop-list').getByRole('link',{name:preview.order.order_number,exact:true}).click();await expect(page).toHaveURL(/order=/);await page.goBack();await expect(page.getByRole('dialog')).toHaveCount(0);await page.goForward();await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('button',{name:'Close order'}).click();await page.getByRole('searchbox').fill('synthetic-no-match');await page.getByRole('searchbox').press('Enter');await expect(page).toHaveURL(/q=synthetic-no-match/);await expect(page.getByText('No orders match these filters.')).toBeVisible();
});
test('unauthenticated preview does not expose an order',async({browser,baseURL})=>{
 const context=await browser.newContext();try{const response=await context.request.get(`${baseURL}/admin/orders/${id}/preview`,{maxRedirects:0});expect([303,307,308,401,403]).toContain(response.status());expect(await response.text()).not.toContain('customer_email');}finally{await context.close();}
});
test('selected-batch routes preserve the supplied synthetic batch',async({page})=>{
 test.skip(batchIds.length!==2||!batchIds.every(v=>uuid.test(v)),'Supply two paid synthetic IDs in ECL_ADMIN_ORDERS_TEST_BATCH_IDS.');
 const returnTo='/admin/orders?status=to_fulfil&shipping=express&page=2';await page.goto(`/admin/orders/${batchIds[0]}/pack?${new URLSearchParams({batch:batchIds.join(','),returnTo})}`);await expect(page.getByText('Selected batch · 1 of 2',{exact:false})).toBeVisible();await page.getByRole('link',{name:'Skip to the next order'}).click();await expect(page).toHaveURL(new RegExp(`/orders/${batchIds[1]}/pack`));await page.getByRole('link',{name:'Exit',exact:true}).click();await expect(page).toHaveURL(/status=to_fulfil.*shipping=express/);
});
test('bulk action refresh retains its result in the mounted workspace',async({page})=>{
 test.skip(process.env.ECL_ADMIN_ORDERS_ALLOW_MUTATIONS!=='disposable','Payment mutations require explicit disposable test authorization.');
 const preview=await (await page.request.get(`/admin/orders/${id}/preview`)).json();expect(preview.order.status).toBe('pending');await page.goto(`/admin/orders?status=pending&q=${encodeURIComponent(preview.order.order_number)}`);await page.locator('.ow-desktop-list').getByLabel(`Select ${preview.order.order_number}`,{exact:true}).check();await page.getByRole('button',{name:'Confirm 1 payment'}).click();await page.getByRole('dialog').getByRole('button',{name:'Confirm payments'}).click();await expect(page.getByText('Payments confirmed: 1 succeeded · 0 failed')).toBeVisible();await expect(page.getByText('No orders match these filters.')).toBeVisible();
});
