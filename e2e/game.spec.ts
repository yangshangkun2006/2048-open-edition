import { expect, test } from '@playwright/test';
import { injectBoard, tileCount, tiles } from './helpers';

test('fresh load: 2 tiles, score 0, best 0, intro hint visible', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.tile')).toHaveCount(2);
  await expect(page.locator('#score')).toHaveText('0');
  await expect(page.locator('#best')).toHaveText('0');
  await expect(page.locator('#notice-intro')).toBeVisible();
});

test('ArrowLeft merges 2+2, spawns, scores +4, hides intro hint', async ({ page }) => {
  await injectBoard(page, '2200/0000/0000/0000');
  await page.keyboard.press('ArrowLeft');
  const t = await tiles(page);
  expect(t.length).toBe(2); // one merged 4 + one spawn
  expect(t.some((x) => x.value === 4 && x.c === 0 && x.r === 0)).toBe(true);
  await expect(page.locator('#score')).toHaveText('4');
  await expect(page.locator('#notice-intro')).toBeHidden();
});

test('WASD mapping', async ({ page }) => {
  await injectBoard(page, '2000/0000/0000/0000');
  await page.keyboard.press('w'); // up: already at top wall
  let t = await tiles(page);
  expect(t.some((x) => x.c === 0 && x.r === 0)).toBe(true);
  await page.keyboard.press('s'); // down: slides to bottom
  t = await tiles(page);
  expect(t.some((x) => x.c === 0 && x.r === 3)).toBe(true);
});

test('HJKL vim mapping', async ({ page }) => {
  await injectBoard(page, '2000/0000/0000/0000');
  await page.keyboard.press('h'); // left: at wall
  let t = await tiles(page);
  expect(t.some((x) => x.c === 0 && x.r === 0)).toBe(true);
  await page.keyboard.press('l'); // right: slides to far right
  t = await tiles(page);
  expect(t.some((x) => x.c === 3 && x.r === 0)).toBe(true);
});

test('Shift+Arrow does not move (modifier combos preserved)', async ({ page }) => {
  await injectBoard(page, '0002/0000/0000/0000');
  await page.keyboard.press('Shift+ArrowLeft');
  const t = await tiles(page);
  expect(t.some((x) => x.c === 3 && x.r === 0)).toBe(true);
});

test('invalid move on a full no-match board: no change, no spawn', async ({ page }) => {
  await injectBoard(page, '24816/42168/81624/16842');
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(300); // let any (illegal) animations settle
  expect(await tileCount(page)).toBe(16);
  await expect(page.locator('#score')).toHaveText('0');
});

test('I opens the board status dialog, Esc closes it', async ({ page }) => {
  await injectBoard(page, '2200/0000/0000/0000');
  await page.keyboard.press('i');
  await expect(page.locator('#overlay-boardinfo')).toBeVisible();
  const cells = page.locator('#boardinfo-table td');
  await expect(cells).toHaveCount(16);
  await page.keyboard.press('Escape');
  await expect(page.locator('#overlay-boardinfo')).toBeHidden();
});
