import {test, expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async({page})=>{
 await page.route('**/*',route=>{
  const url=new URL(route.request().url());
  return url.hostname==='127.0.0.1'||url.protocol==='data:'?route.continue():route.abort();
 });
 await page.goto('/navy.html');
});

test('research areas work with a keyboard and retain readable layouts at narrow widths',async({page})=>{
 const explorer=page.getByRole('region',{name:'Explore by research area.'});
 const choice=explorer.getByRole('button',{name:'Preview Metabolic & Weight'});
 await choice.focus();
 await page.keyboard.press('Enter');
 await expect(choice).toHaveAttribute('aria-pressed','true');
 await expect(choice).toBeFocused();
 await expect(explorer.getByRole('img')).toHaveAttribute('alt','Retatrutide — Metabolic & Weight collection');
 await expect(explorer.getByRole('link',{name:'Explore Metabolic & Weight'})).toHaveAttribute('href','/collections/metabolic-weight?rebrand=v2');
 await page.evaluate(()=>document.fonts.ready.then(()=>undefined));
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const result=await new AxeBuilder({page}).include('.rebrand').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
 expect(result.violations).toEqual([]);
});

test('newsletter exposes retry and confirmation feedback without contacting a service',async({page})=>{
 const newsletter=page.getByRole('region',{name:'Stay curious. Stay informed.'});
 let attempts=0;
 await page.route('**/api/subscribe',async route=>{
  expect(route.request().postDataJSON()).toEqual({email:'reader@example.test',source:'footer'});
  attempts++;
  await route.fulfill({status:attempts===1?503:200,contentType:'application/json',body:JSON.stringify(attempts===1?{ok:false}:{ok:true,message:'Check your email to confirm your subscription.'})});
 });
 await newsletter.getByRole('textbox',{name:'Email address'}).fill('reader@example.test');
 await newsletter.getByRole('button',{name:'Subscribe'}).click();
 await expect(newsletter.getByRole('alert')).toBeVisible();
 const errorAxe=await new AxeBuilder({page}).include('.rb-newsletter').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
 expect(errorAxe.violations).toEqual([]);
 await newsletter.getByRole('button',{name:'Subscribe'}).click();
 await expect(newsletter.getByRole('status')).toHaveText('Check your email to confirm your subscription.');
 expect(attempts).toBe(2);
 const successAxe=await new AxeBuilder({page}).include('.rb-newsletter').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
 expect(successAxe.violations).toEqual([]);
});

test('skip navigation and FAQ disclosures work with the keyboard and reduced motion',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.keyboard.press('Tab');
 await expect(page.getByRole('link',{name:'Skip to content'})).toBeFocused();
 await page.keyboard.press('Enter');
 await expect(page.locator('#main-content')).toBeFocused();
 const summary=page.locator('.rb-faq-items summary').first();
 await summary.focus();
 await page.keyboard.press('Enter');
 await expect(page.locator('.rb-faq-items details').first()).toHaveAttribute('open','');
 await page.keyboard.press('Enter');
 await expect(page.locator('.rb-faq-items details').first()).not.toHaveAttribute('open','');
 const transition=await page.locator('.rb-area-row > a').first().evaluate(e=>getComputedStyle(e).transitionDuration);
 expect(transition).toBe('0s');
});
