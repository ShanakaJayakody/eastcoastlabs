import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async({page})=>{
  await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.pathname.startsWith('/api/'))return route.abort();
    return url.hostname==='127.0.0.1'||url.protocol==='data:'?route.continue():route.abort();
  });
});
test('size buttons update offers and keep two strengths separate through a cart reload',async({page},info)=>{
  await page.goto('/frame.html?page=sizes');
  await expect(page.getByTestId('size-price')).toContainText('$45.00');
  await page.getByRole('radio',{name:'20 mg',exact:true}).locator('..').click();
  await expect(page.getByTestId('size-price')).toContainText('$75.00');
  await page.getByRole('radio',{name:/1 vial/}).locator('..').click();
  await page.getByRole('button',{name:/Add to Cart ·/}).click();
  const cart=page.getByRole('dialog',{name:'Shopping cart'});
  await expect(cart).toContainText('1 vial · 20 mg');
  await page.keyboard.press('Escape');
  await page.getByRole('radio',{name:'10 mg',exact:true}).locator('..').click();
  await page.getByRole('button',{name:/Add to Cart ·/}).click();
  await expect(cart).toContainText('3-pack · 10 mg');
  const lines=await page.evaluate(()=>JSON.parse(localStorage.getItem('ecl_cart_v1')!).lines);
  expect(lines.map((line:{slug:string;unitPrice:number})=>[line.slug,line.unitPrice])).toEqual([['size-fixture-20',75],['size-fixture',122]]);
  await page.keyboard.press('Escape');
  await page.reload();
  await page.getByRole('button',{name:'Open preview cart',exact:true}).click();
  await expect(cart).toContainText('1 vial · 20 mg');
  await expect(cart).toContainText('3-pack · 10 mg');
  await page.keyboard.press('Escape');
  await page.getByRole('radio',{name:'30 mg',exact:true}).locator('..').click();
  await expect(page.getByText('This size is out of stock.')).toBeVisible();
  await expect(page.getByRole('button',{name:'Notify me',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:/Add to Cart ·/})).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.getByRole('radio',{name:'20 mg',exact:true}).locator('..').click();
  const accessibility=await new AxeBuilder({page}).include('#main-content').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  expect(accessibility.violations.filter(v=>['serious','critical'].includes(v.impact??''))).toEqual([]);
  await page.locator('#main-content').screenshot({path:info.outputPath('product-sizes.png')});
});

test('admin size editor fits mobile and makes price, pack and stock entry explicit',async({page},info)=>{
  await page.goto('/frame.html?page=sizes-admin');
  await expect(page.getByRole('heading',{name:'Sizes & pricing'})).toBeVisible();
  await page.getByRole('button',{name:'Add size',exact:true}).click();
  await page.getByLabel('New size',{exact:true}).fill('40 mg');
  await page.getByLabel('New size single vial price').fill('120');
  await expect(page.getByLabel('New size 3-pack price')).toHaveValue('324');
  await page.getByLabel('New size 3-pack price').fill('315');
  await page.getByLabel('New size opening stock').fill('10');
  await expect(page.getByRole('button',{name:'Add size & save'})).toBeEnabled();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  const accessibility=await new AxeBuilder({page}).include('#main-content').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  expect(accessibility.violations.filter(v=>['serious','critical'].includes(v.impact??''))).toEqual([]);
  await page.locator('#main-content').screenshot({path:info.outputPath('admin-sizes.png')});
});
