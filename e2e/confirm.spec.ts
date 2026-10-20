import { expect, test } from '@playwright/test';
import { injectBoard, tileCount, tiles } from './helpers';

test('New Game with progress asks for confirmation; cancel keeps the board', async ({ page }) => {
  await injectBoard(page, '2000/0000/0000/0000', { moves: 3 });
  const before = await tiles(page);
  await page.locator('#btn-new').click();
  await expect(page.locator('#overlay-confirm')).toBeVisible();
  const during = await tiles(page);
  expect(during).toEqual(before);
  await page.keyboard.press('Escape');
  await expect(page.locator('#overlay-confirm')).toBeHidden();
  expect(await tiles(page)).toEqual(before);
  await expect(page.locator('#score')).toHaveText('0');
});

test('R key opens confirm with focus on keep-playing; confirming starts fresh', async ({ page }) => {
  await injectBoard(page, '2200/0000/0000/0000', { moves: 5, score: 8 });
  await page.keyboard.press('r');
  await expect(page.locator('#overlay-confirm')).toBeVisible();
  await expect(page.locator('#btn-keep-playing')).toBeFocused();
  await page.locator('#btn-confirm-new').click();
  await expect(page.locator('#overlay-confirm')).toBeHidden();
  await expect(page.locator('.tile')).toHaveCount(2);
  await expect(page.locator('#score')).toHaveText('0');
});

test('New Game on a fresh board resets immediately without confirm', async ({ page }) => {
  await injectBoard(page, '2000/0000/0000/0000', { moves: 0 });
  await page.locator('#btn-new').click();
  await expect(page.locator('#overlay-confirm')).toBeHidden();
  await expect(page.locator('.tile')).toHaveCount(2);
});

test('direction keys do not change the board while the confirm is open', async ({ page }) => {
  await injectBoard(page, '2000/0000/0000/0000', { moves: 3 });
  const before = await tiles(page);
  await page.locator('#btn-new').click();
  await expect(page.locator('#overlay-confirm')).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  expect(await tileCount(page)).toBe(before.length);
  expect(await tiles(page)).toEqual(before);
});
