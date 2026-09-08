import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async({page})=>{
 // All actions are bundled local fakes. Prevent accidental external requests.
 await page.route('**/*',route=>{
  const url=new URL(route.request().url());
  return url.hostname==='127.0.0.1'||url.protocol==='data:'?route.continue():route.abort();
 });
 await page.goto('/frame.html');
 await page.getByRole('button',{name:'Load synthetic cart',exact:true}).click();
 await expect(page.getByRole('button',{name:'Place order',exact:true})).toBeEnabled();
});
test('checkout fits viewport with labelled controls and no serious accessibility violations',async({page})=>{
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 for(const label of ['Email address','Full name','Street address','Suburb','Postcode'])await expect(page.getByLabel(label,{exact:true})).toBeVisible();
 const result=await new AxeBuilder({page}).include('#main-content').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
 expect(result.violations.filter(v=>['serious','critical'].includes(v.impact??''))).toEqual([]);
});
test('failed quote blocks submission and explicit retry recovers',async({page})=>{
 await page.getByLabel('Quote simulation').selectOption('failure');
 await page.getByRole('button',{name:'Refresh order total',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('confirm your order total');
 await expect(page.getByRole('button',{name:'Place order',exact:true})).toBeDisabled();
 await page.getByLabel('Quote simulation').selectOption('normal');
 await page.getByRole('button',{name:'Retry total',exact:true}).click();
 await expect(page.getByRole('button',{name:'Place order',exact:true})).toBeEnabled();
});
test('cart traps keyboard focus and restores its opener on Escape',async({page})=>{
 const opener=page.getByRole('button',{name:'Open preview cart',exact:true});
 await opener.click();
 const dialog=page.getByRole('dialog',{name:'Shopping cart'});
 await expect(dialog).toBeVisible();
 for(let count=0;count<20;count++){
  await page.keyboard.press('Tab');
  expect(await dialog.evaluate(el=>el.contains(document.activeElement))).toBe(true);
 }
 await page.keyboard.press('Escape');
 await expect(dialog).toBeHidden();
 await expect(opener).toBeFocused();
});
test('uncertain submission retains recovery identity but no customer fields after reload',async({page})=>{
 await page.getByLabel('Email address',{exact:true}).fill('synthetic@example.test');
 await page.getByLabel('Full name',{exact:true}).fill('Synthetic Buyer');
 await page.getByLabel('Street address',{exact:true}).fill('1 Test Street');
 await page.getByLabel('Suburb',{exact:true}).fill('Testville');
 await page.getByLabel('Postcode',{exact:true}).fill('3000');
 await page.getByRole('button',{name:'Place order',exact:true}).click();
 await expect(page.getByText(/Synthetic submit 1/)).toBeVisible();
 const storage=await page.evaluate(()=>JSON.stringify({...localStorage,...sessionStorage}));
 expect(storage).not.toContain('synthetic@example.test');
 expect(storage).not.toContain('1 Test Street');
 await page.reload();
 await expect(page.getByLabel('Email address',{exact:true})).toHaveValue('');
 await page.getByRole('button',{name:'Check previous order attempt',exact:true}).click();
 await expect(page.getByText('Synthetic preview: no previous order exists.')).toBeVisible();
});
