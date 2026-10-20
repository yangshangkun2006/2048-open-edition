import { expect, test } from '@playwright/test';
import { injectBoard, tiles } from './helpers';

test('merging two 1024s wins: overlay, keep going continues without a new tile', async ({ page }) => {
  await injectBoard(page, '1024102424/0000/0000/0000');
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#overlay-end')).toBeVisible();
  await expect(page.locator('#end-title')).toHaveText('你做到了！');
  await expect(page.locator('#btn-keep-going')).toBeVisible();
  const t = await tiles(page);
  expect(t.some((x) => x.value === 2048)).toBe(true);

  await page.locator('#btn-keep-going').click();
  await expect(page.locator('#overlay-end')).toBeHidden();
  expect((await tiles(page)).length).toBe(4); // 2048 + 2 + 4 + spawn from the move
  await expect(page.locator('#btn-keep-going')).toBeHidden();
});

test('dead board shows the lose overlay with try-again', async ({ page }) => {
  await injectBoard(page, '22816/832232/162328/416832');
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#overlay-end')).toBeVisible();
  await expect(page.locator('#end-title')).toHaveText('没有可移动的方块了');
  await expect(page.locator('#btn-try-again')).toBeVisible();
  await expect(page.locator('#btn-keep-going')).toBeHidden();
  await expect(page.locator('#score')).toHaveText('4');

  await page.locator('#btn-try-again').click();
  await expect(page.locator('#overlay-end')).toBeHidden();
  await expect(page.locator('.tile')).toHaveCount(2);
  await expect(page.locator('#score')).toHaveText('0');
});

test('win + over in one move: win narrative, no keep-going', async ({ page }) => {
  await injectBoard(page, '10241024816/416232/24328/16842');
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#overlay-end')).toBeVisible();
  await expect(page.locator('#end-title')).toHaveText('你做到了！');
  await expect(page.locator('#btn-keep-going')).toBeHidden();
  await expect(page.locator('#end-sub')).toContainText('无法继续');
});

test('direction keys are ignored while the end overlay is open', async ({ page }) => {
  await injectBoard(page, '22816/832232/162328/416832');
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#overlay-end')).toBeVisible();
  const snapshot = await tiles(page);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowUp');
  expect(await tiles(page)).toEqual(snapshot);
});
