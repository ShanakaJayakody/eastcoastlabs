import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('customer receipt stays readable, private and accessible across screen sizes',async({page})=>{
 await page.goto('/customer-order.html');await expect(page.getByRole('heading',{name:'ECL-1042'})).toBeVisible();
 await expect(page.getByText('Quantity 2')).toBeVisible();await expect(page.getByText('50 mg · 1 vial')).toBeVisible();await expect(page.getByText('sample@example.test')).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 const audit=await new AxeBuilder({page}).analyze();expect(audit.violations).toEqual([]);
 await page.goto('/customer-order.html?owner=1&no-images=1');await expect(page.getByText('123 Example Street')).toBeVisible();await expect(page.getByLabel('Product image unavailable')).toHaveCount(2);
});
test('passwordless sign-in shows the challenge mailbox and recoverable code errors',async({page})=>{
 await page.goto('/customer-order.html?signin=1');await page.getByLabel('Email used at checkout').fill('sample@example.test');await page.getByRole('button',{name:'Send sign-in code'}).click();
 await expect(page.getByText('sample@example.test',{exact:true})).toBeVisible();await page.getByLabel('Email code').fill('999999');await page.getByRole('button',{name:'Verify and continue'}).click();await expect(page.getByRole('alert')).toContainText('invalid or expired');
 await page.getByRole('button',{name:'Use another email'}).click();await expect(page.getByLabel('Email used at checkout')).toBeVisible();
 expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
});
