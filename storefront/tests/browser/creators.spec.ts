import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function creatorFixture(page: Page) {
 await page.route('**/*',route=>{
  const url=new URL(route.request().url());
  return url.hostname==='127.0.0.1'||url.protocol==='data:'?route.continue():route.abort();
 });
 await page.goto('/frame.html?page=creators');
 await expect(page.getByRole('heading',{name:/Your influence\./})).toBeVisible();
}

async function fillApplication(page: Page) {
 await page.getByLabel('Full name',{exact:true}).fill('Taylor Creator');
 await page.getByLabel('Email address',{exact:true}).fill('taylor@example.test');
 await page.getByLabel('Primary social profile',{exact:true}).fill('https://instagram.com/taylor.creator/');
 await page.getByLabel('Main discipline',{exact:true}).selectOption('video');
 await page.getByLabel('Your content focus',{exact:true}).selectOption('biohacking');
 await page.getByLabel('Australian state/territory',{exact:true}).selectOption('VIC');
 await page.getByLabel('What would you like to create?',{exact:true}).fill('I create polished short-form creator stories with careful light, product detail and a clear point of view.');
 await page.getByLabel('I am 18 or over and based in Australia.',{exact:true}).check();
 await page.getByLabel(/I agree that ECL may review my application/).check();
}

async function stickyInViewport(page: Page) {
 const box=await page.locator('button').filter({hasText:'Apply to the collective'}).last().boundingBox();
 const viewport=page.viewportSize();
 return Boolean(box&&viewport&&box.y>=0&&box.y+box.height<=viewport.height);
}

test.beforeEach(async({page})=>{await creatorFixture(page);});

test('creator page fits every configured viewport, renders final imagery and has no serious accessibility violations',async({page})=>{
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 const cover=page.getByAltText(/Fictional adult creators celebrating/);
 await expect(cover).toBeVisible();
 const imageState=await page.locator('img[alt^=\"Fictional\"]').evaluateAll(images=>images.map(image=>{const img=image as HTMLImageElement;return {complete:img.complete,naturalWidth:img.naturalWidth,naturalHeight:img.naturalHeight,alt:img.alt};}));
 expect(imageState).toHaveLength(6);
 expect(imageState.every(image=>image.complete&&image.naturalWidth>0&&image.naturalHeight>0)).toBe(true);
 const coverBox=await cover.boundingBox();
 expect(coverBox?.width).toBeGreaterThan(260);
 expect((coverBox?.width??0)/(coverBox?.height??1)).toBeGreaterThan(1.6);
 const result=await new AxeBuilder({page}).include('#main-content').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
 expect(result.violations.filter(v=>['serious','critical'].includes(v.impact??''))).toEqual([]);
});

test('application and rewards CTAs navigate to the right page sections',async({page})=>{
 await page.getByRole('link',{name:/Apply to the collective/}).first().click();
 await expect.poll(()=>page.evaluate(()=>window.location.hash)).toBe('#apply');
 await expect(page.locator('#apply')).toBeInViewport();
 await page.getByRole('link',{name:/Explore the rewards/}).click();
 await expect.poll(()=>page.evaluate(()=>window.location.hash)).toBe('#rewards');
 await expect(page.locator('#rewards')).toBeInViewport();
});

test('FAQ opens from the keyboard',async({page})=>{
 const summary=page.getByText('Do I need a large following?',{exact:true});
 await summary.focus();
 await page.keyboard.press('Enter');
 await expect(page.getByText(/we assess the quality and relevance of your work/i)).toBeVisible();
});

test('form validation focuses the first field and creator focus is submitted through the fixture adapter',async({page})=>{
 await page.getByRole('button',{name:/Send my application/}).click();
 await expect(page.getByLabel('Full name',{exact:true})).toBeFocused();
 await expect(page.getByLabel('Full name',{exact:true})).toHaveAccessibleDescription('Full name is too short.');
 await fillApplication(page);
 await expect(page.getByLabel('Your content focus',{exact:true})).toHaveValue('biohacking');
 await page.getByRole('button',{name:/Send my application/}).click();
 await expect(page.getByRole('status')).toContainText('Your application is in.');
});

test('backend unavailable and server field errors are accessible and retryable',async({page})=>{
 await page.getByLabel('Creator submission simulation').selectOption('unavailable');
 await fillApplication(page);
 await page.getByRole('button',{name:/Send my application/}).click();
 await expect(page.getByRole('alert')).toContainText('Applications are temporarily unavailable.');
 await expect(page.getByLabel('Email address',{exact:true})).toHaveValue('taylor@example.test');
 await page.getByLabel('Creator submission simulation').selectOption('field-error');
 await page.getByRole('button',{name:/Send my application/}).click();
 await expect(page.getByLabel('Email address',{exact:true})).toBeFocused();
 await expect(page.getByLabel('Email address',{exact:true})).toHaveAccessibleDescription('Synthetic creator email needs correction.');
});

test('mobile sticky CTA appears after the hero and suppresses over the application form',async({page},testInfo)=>{
 test.skip(testInfo.project.name==='desktop','Sticky CTA is mobile-only.');
 await page.goto('/frame.html?page=creators&bare=1');
 const stickyButton=page.locator('button').filter({hasText:'Apply to the collective'}).last();
 await expect(stickyButton).toBeDisabled();
 await expect(stickyButton).toHaveAttribute('tabindex','-1');
 await page.locator('#rewards').scrollIntoViewIfNeeded();
 await expect.poll(()=>stickyInViewport(page)).toBe(true);
 await expect(stickyButton).toBeEnabled();
 await stickyButton.click();
 await expect(page.locator('#creator-apply-title')).toBeFocused();
 await expect.poll(()=>stickyInViewport(page)).toBe(false);
});

test('reduced motion disables creator transition effects',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/frame.html?page=creators');
 const duration=await page.locator('#main-content a').first().evaluate(el=>getComputedStyle(el).transitionDuration);
 expect(duration).toBe('0s');
});

test('desktop visual pass covers the 1440px hero composition',async({page},testInfo)=>{
 test.skip(testInfo.project.name!=='desktop','One explicit 1440px pass is enough.');
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/frame.html?page=creators&bare=1');
 await expect(page.getByRole('heading',{name:/Your influence\./})).toBeVisible();
 await expect(page.getByRole('link',{name:/Apply to the collective/}).first()).toBeInViewport();
 const cover=page.getByAltText(/Fictional adult creators celebrating/);
 await expect(cover).toBeInViewport({ratio:0.45});
 expect(await page.screenshot({fullPage:false})).toBeTruthy();
});
