import {test, expect} from '@playwright/test';

test('public purchase and checkout use Navy while admin retains its theme',async({page})=>{
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  await page.goto('/frame.html?page=checkout');
  await expect(page.locator('.navy-store')).toHaveCSS('background-color','rgb(251, 252, 253)');
  await expect(page.getByRole('main')).toHaveCount(1);
  await expect(page.getByRole('region',{name:'Stay curious. Stay informed.'})).toHaveCount(0);
  await page.goto('/frame.html?page=sizes');
  await expect(page.locator('.navy-store')).toHaveCSS('background-color','rgb(251, 252, 253)');
  await page.goto('/frame.html?page=sizes-admin');
  await expect(page.locator('.navy-store')).toHaveCount(0);
  await expect(page.locator('body')).toHaveCSS('background-color','rgb(8, 11, 16)');
});
