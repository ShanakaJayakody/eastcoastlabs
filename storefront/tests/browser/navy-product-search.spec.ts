import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async({page})=>{
  await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    return url.hostname==='127.0.0.1'||url.protocol==='data:'?route.continue():route.abort();
  });
  await page.goto('/navy.html');
});

test('finds all products, preserves exact sizes and keeps open suggestions accessible',async({page})=>{
  const search=page.getByRole('combobox',{name:'Search products'});
  await search.fill('tesamorelin');
  await expect(page.getByRole('option',{name:/Tesamorelin/})).toHaveAttribute('href','/product/tesamorelin?rebrand=v2');
  await search.fill('BPC 5 mg');
  const option=page.getByRole('option');
  await expect(option).toHaveText(/BPC-157.*5 mg.*\$45.00.*Out of stock/);
  await expect(option).not.toContainText('15 mg');
  await expect(option).toHaveAttribute('href','/product/bpc-157?size=bpc-157-small&rebrand=v2');
  await search.press('ArrowDown');
  await expect(option).toHaveAttribute('aria-selected','true');
  await expect(search).toHaveAttribute('aria-activedescendant',await option.getAttribute('id') ?? '');
  const result=await new AxeBuilder({page}).include('.rb-finder').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  expect(result.violations).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('uses compact desktop suggestions and inline mobile results without covering the collection',async({page},testInfo)=>{
  const search=page.getByRole('combobox',{name:'Search products'});
  await search.click();
  await expect(page.getByRole('option')).toHaveCount(5);
  await expect(page.locator('.rb-finder-panel')).toHaveCSS('position',testInfo.project.name==='desktop'?'absolute':'static');
  if(testInfo.project.name!=='desktop'){
    const panel=await page.locator('.rb-finder-panel').boundingBox();
    const filters=await page.locator('.rb-filters').boundingBox();
    expect(panel!.y+panel!.height).toBeLessThanOrEqual(filters!.y);
  }
  await search.press('ArrowUp');
  await expect(page.getByRole('option').last()).toHaveAttribute('aria-selected','true');
  await expect(page.getByRole('option').last()).toBeInViewport({ratio:1});
  await search.press('Escape');
  await expect(page.getByRole('listbox')).toBeHidden();
  await expect(search).toBeFocused();
});

test('recovers from no results and keeps full-result links consistent',async({page})=>{
  const search=page.getByRole('combobox',{name:'Search products'});
  await search.fill('unlisted product');
  await expect(page.getByText('No products found',{exact:true})).toBeVisible();
  await expect(page.locator('.rb-finder-all')).toHaveAttribute('href','/shop?rebrand=v2');
  await page.getByRole('button',{name:'Clear search'}).click();
  await expect(search).toHaveValue('');
  await page.getByRole('button',{name:'BPC-157',exact:true}).click();
  await expect(page.getByRole('option').first()).toHaveAttribute('href','/product/bpc-157?rebrand=v2');
  await search.fill('BPC 10 mg');
  await expect(page.getByRole('link',{name:'View all 1 result'})).toHaveAttribute('href','/shop?q=BPC+10+mg&rebrand=v2');
  await page.getByRole('heading',{name:'Find your research peptide.'}).click();
  await expect(search).toHaveAttribute('aria-expanded','false');
});

test('opens the selected product and size with a pointer',async({page})=>{
  await page.getByRole('combobox',{name:'Search products'}).fill('BPC 10 mg');
  await page.route('**/product/bpc-157?*',route=>route.fulfill({contentType:'text/html',body:'<h1>Selected product destination</h1>'}));
  await page.getByRole('option').click();
  await expect(page).toHaveURL(/\/product\/bpc-157\?size=bpc-157&rebrand=v2$/);
});

test('header search brings the finder into view and focuses it',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='desktop','The desktop header contains the search shortcut.');
  await page.getByRole('link',{name:'Search peptides',exact:true}).click();
  const search=page.getByRole('combobox',{name:'Search products'});
  await expect(search).toBeFocused();
  await expect(search).toBeInViewport();
  const box=await search.boundingBox();
  const header=await page.locator('.rb-header').boundingBox();
  expect(box!.y).toBeGreaterThanOrEqual(header!.y+header!.height);
});
