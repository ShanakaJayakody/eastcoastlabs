import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test.beforeEach(async({page})=>{
  await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    return url.hostname==='127.0.0.1' && !url.pathname.startsWith('/api/') ? route.continue() : route.abort();
  });
});
test('keeps price in the opening screen and the selected purchase accessible through scrolling',async({page},info)=>{
  await page.goto('/mobile-shopping.html');
  const price=page.getByTestId('size-price');
  await expect(price).toHaveText(/\$80.00/);
  expect((await price.boundingBox())!.y).toBeLessThan(450);
  await page.screenshot({path:info.outputPath('opening-screen.png')});
  const action=page.getByRole('button',{name:'Add to Cart · $80.00',exact:true});
  if ((await action.boundingBox())!.y + (await action.boundingBox())!.height > page.viewportSize()!.height) {
    await expect(page.getByRole('button',{name:'Choose options'})).toBeVisible();
    await page.getByRole('button',{name:'Choose options'}).click();
    await expect(page.locator('[data-purchase-options]')).toBeFocused();
  }
  await action.scrollIntoViewIfNeeded();
  await expect(page.getByRole('region',{name:'Quick purchase'})).toBeHidden();
  await page.screenshot({path:info.outputPath('purchase-controls.png')});
  await page.getByRole('radio',{name:/3-pack/}).locator('..').click();
  await page.getByRole('heading',{name:'Product details · 100 mg'}).scrollIntoViewIfNeeded();
  const sticky=page.getByRole('region',{name:'Quick purchase'});
  await expect(sticky).toBeVisible();
  await expect(sticky).toContainText('3-pack · 100 mg');
  await expect(sticky).toContainText('$216.00');
  await sticky.getByRole('button',{name:'Add to Cart',exact:true}).click();
  const cart=page.getByRole('dialog',{name:'Shopping cart'});
  await expect(cart).toContainText('3-pack · 100 mg');
  await expect(cart).toContainText('$216.00');
  await expect(sticky).toBeHidden();
  await page.keyboard.press('Escape');
  await page.getByRole('radio',{name:'50 mg',exact:true}).locator('..').click();
  await expect(price).toContainText('$50.00');
  await expect(page.getByRole('img',{name:'GHK-Cu 50 mg illustration'})).toBeVisible();
  await page.getByRole('radio',{name:'20 mg',exact:true}).locator('..').click();
  await expect(page.getByRole('button',{name:'Notify me',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:/Add to Cart/})).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const a11y=await new AxeBuilder({page}).include('#main-content').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  expect(a11y.violations.filter(v=>['serious','critical'].includes(v.impact??''))).toEqual([]);
});

test('updates the sticky action after an instant jump from above the button to documentation',async({page})=>{
  await page.setViewportSize({width:390,height:500});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/mobile-shopping.html');
  await expect(page.getByRole('button',{name:'Choose options'})).toBeVisible();
  await page.getByRole('link',{name:'Historical supplier report',exact:true}).click();
  await expect(page.getByRole('region',{name:'Quick purchase'}).getByRole('button',{name:'Add to Cart',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Add to Cart · $80.00',exact:true}).evaluate(el => window.scrollTo({top:el.getBoundingClientRect().top + window.scrollY - 10,behavior:'instant'}));
  await expect(page.getByRole('region',{name:'Quick purchase'}).getByRole('button',{name:'Add to Cart',exact:true})).toBeVisible();
  await page.evaluate(() => window.scrollTo({top:0,behavior:'instant'}));
  await expect(page.getByRole('button',{name:'Choose options'})).toBeVisible();
});
