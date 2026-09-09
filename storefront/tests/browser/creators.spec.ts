import {test,expect,type Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const pitch='I create polished short-form creator stories with careful light, product detail and a clear point of view.';

async function creatorFixture(page:Page){
 await page.route('**/*',route=>{
  const url=new URL(route.request().url());
  return url.hostname==='127.0.0.1'||url.protocol==='data:'?route.continue():route.abort();
 });
 await page.goto('/frame.html?page=creators');
 await expect(page.getByRole('heading',{name:/Your influence\./})).toBeVisible();
}

async function continueStep(page:Page){
 await page.getByRole('button',{name:'Continue'}).click();
}

async function textStep(page:Page,label:string,value:string){
 await page.getByLabel(label,{exact:true}).fill(value);
 await continueStep(page);
}

async function choiceStep(page:Page,label:string){
 await page.getByRole('radio',{name:label}).check();
 await continueStep(page);
}

async function fillApplication(page:Page){
 await textStep(page,'Full name','Taylor Creator');
 await fillApplicationFromEmail(page);
}

async function fillApplicationFromEmail(page:Page){
 await textStep(page,'Email address','taylor@example.test');
 await textStep(page,'Phone number','0412 345 678');
 await textStep(page,'Primary social profile','https://instagram.com/taylor.creator/');
 await page.getByRole('button',{name:'Skip for now'}).click();
 await choiceStep(page,'Video');
 await choiceStep(page,'Biohacking');
 await choiceStep(page,'VIC');
 await textStep(page,'Tell us about your audience and content',pitch);
 await textStep(page,'Audience size','1200');
 await page.getByLabel('I am 18 or over and based in Australia.',{exact:true}).check();
 await page.getByLabel(/I agree that ECL may review my application/).check();
 await continueStep(page);
 await expect(page.getByRole('heading',{name:'Review your application'})).toBeVisible();
}

async function reachDiscipline(page:Page){
 await textStep(page,'Full name','Taylor Creator');
 await textStep(page,'Email address','taylor@example.test');
 await textStep(page,'Phone number','0412 345 678');
 await textStep(page,'Primary social profile','https://instagram.com/taylor.creator/');
 await page.getByRole('button',{name:'Skip for now'}).click();
}

async function reachPitch(page:Page){
 await reachDiscipline(page);
 await choiceStep(page,'Video');
 await choiceStep(page,'Biohacking');
 await choiceStep(page,'VIC');
}

async function stickyInViewport(page:Page){
 const box=await page.locator('button').filter({hasText:'Apply to the collective'}).last().boundingBox();
 const viewport=page.viewportSize();
 return Boolean(box&&viewport&&box.y>=0&&box.y+box.height<=viewport.height);
}

async function seriousAxeViolations(page:Page){
 const result=await new AxeBuilder({page}).include('#main-content').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
 return result.violations.filter(v=>['serious','critical'].includes(v.impact??''));
}

test.beforeEach(async({page})=>{await creatorFixture(page);});

test('creator page fits every configured viewport, renders final imagery and has no serious accessibility violations',async({page})=>{
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 const cover=page.getByAltText(/Fictional adult creators celebrating/);
 await expect(cover).toBeVisible();
 const creatorImages=page.locator('img[alt^=\"Fictional\"]');
 await expect(creatorImages).toHaveCount(6);
 await expect.poll(async()=>creatorImages.evaluateAll(images=>images.every(image=>{const img=image as HTMLImageElement;return img.complete&&img.naturalWidth>0&&img.naturalHeight>0;})),{message:'all fictional creator images should decode'}).toBe(true);
 const coverBox=await cover.boundingBox();
 expect(coverBox?.width).toBeGreaterThan(260);
 expect((coverBox?.width??0)/(coverBox?.height??1)).toBeGreaterThan(1.6);
 expect(await seriousAxeViolations(page)).toEqual([]);
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
 await expect(page.getByText(/Audience size is part of our review/i)).toBeVisible();
});

test('wizard validation focuses the active question and submits after review',async({page})=>{
 await page.getByRole('link',{name:/Apply to the collective/}).first().click();
 await page.getByRole('button',{name:'Continue'}).click();
 await expect(page.getByLabel('Full name',{exact:true})).toBeFocused();
 await expect(page.getByLabel('Full name',{exact:true})).toHaveAccessibleDescription('Full name is too short.');
 await page.getByLabel('Full name',{exact:true}).fill('Taylor Creator');
 await page.keyboard.press('Enter');
 await expect(page.getByLabel('Email address',{exact:true})).toBeVisible();
 await fillApplicationFromEmail(page);
 expect(await seriousAxeViolations(page)).toEqual([]);
 await page.getByRole('button',{name:/Send my application/}).click();
 await expect(page.getByRole('status')).toContainText('Your application is in.');
});

test('choice questions use keyboardable native radios without auto-advancing',async({page})=>{
 await reachDiscipline(page);
 await page.getByRole('radio',{name:'Video'}).focus();
 await page.keyboard.press('Space');
 await page.keyboard.press('ArrowDown');
 await expect(page.getByRole('radio',{name:'Video'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Continue'})).toBeVisible();
 expect(await seriousAxeViolations(page)).toEqual([]);
 await continueStep(page);
 await expect(page.getByRole('radio',{name:'Biohacking'})).toBeVisible();
});

test('textarea Enter inserts a newline and keeps the pitch step active',async({page})=>{
 await reachPitch(page);
 const field=page.getByLabel('Tell us about your audience and content',{exact:true});
 await field.fill('Line one');
 await field.press('Enter');
 await field.type('Line two with enough creator detail to pass later.');
 await expect(field).toHaveValue('Line one\nLine two with enough creator detail to pass later.');
 await expect(page.getByRole('button',{name:'Continue'})).toBeVisible();
 await expect(page.getByRole('textbox',{name:'Audience size'})).toHaveCount(0);
});

test('Other focus requires a typed answer and audience size requires an exact count',async({page})=>{
 await reachDiscipline(page);
 await choiceStep(page,'Video');
 await page.getByRole('radio',{name:'Other'}).check();
 const other=page.getByRole('textbox',{name:'Tell us what you love talking about'});
 await expect(other).toBeVisible();
 await continueStep(page);
 await expect(other).toBeFocused();
 await expect(other).toHaveAccessibleDescription(/required|too short/i);
 await other.fill('Recovery routines');
 await continueStep(page);
 await choiceStep(page,'VIC');
 await textStep(page,'Tell us about your audience and content',pitch);
 await continueStep(page);
 const audience=page.getByRole('textbox',{name:'Audience size'});
 await expect(audience).toBeFocused();
 await audience.fill('1.5');
 await continueStep(page);
 await expect(audience).toHaveAccessibleDescription(/primary profile.*0 if you do not have an audience yet.*Enter an exact audience number\./);
 await audience.fill('0');
 await continueStep(page);
 await page.getByLabel('I am 18 or over and based in Australia.',{exact:true}).check();
 await page.getByLabel(/I agree that ECL may review my application/).check();
 await continueStep(page);
 await expect(page.getByRole('heading',{name:'Review your application'})).toBeVisible();
 await expect(page.getByText('Other: Recovery routines')).toBeVisible();
 const summary=page.getByRole('region',{name:'Application summary'});
 await expect(summary.getByText('0',{exact:true})).toBeVisible();
});

test('mobile wizard steps fit 320px and 390px without horizontal overflow',async({page},testInfo)=>{
 test.skip(testInfo.project.name==='desktop','Mobile fit is covered in the mobile projects.');
 await page.goto('/frame.html?page=creators&bare=1#apply');
 await expect(page.getByLabel('Full name',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 const wizard=page.locator('form').first();
 const viewport=page.viewportSize();
 const box=await wizard.boundingBox();
 expect(box&&viewport&&box.width<=viewport.width).toBe(true);
 await reachDiscipline(page);
 const choiceBox=await wizard.boundingBox();
 expect(choiceBox&&viewport&&choiceBox.width<=viewport.width).toBe(true);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});

test('backend unavailable and server field errors are accessible and retryable',async({page})=>{
 await page.getByLabel('Creator submission simulation').selectOption('unavailable');
 await fillApplication(page);
 await page.getByRole('button',{name:/Send my application/}).click();
 await expect(page.getByRole('alert')).toContainText('Applications are temporarily unavailable.');
 await expect(page.getByText('taylor@example.test')).toBeVisible();
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
