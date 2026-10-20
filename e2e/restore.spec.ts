import { expect, test } from '@playwright/test';
import { injectBest, injectBoard, tiles } from './helpers';

test('reload restores the exact board and score, with a restored notice', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowUp');
  const before = await tiles(page);
  const scoreBefore = await page.locator('#score').textContent();

  await page.reload();
  await expect(page.locator('#notice-restored')).toBeVisible();
  expect(await tiles(page)).toEqual(before);
  await expect(page.locator('#score')).toHaveText(scoreBefore ?? '0');
});

test('corrupt save: no white screen, fresh game, best preserved', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('2048:v2:game', '{{{ definitely not json');
    localStorage.setItem('2048:v2:best', '512');
  });
  await page.goto('/');
  await expect(page.locator('.tile')).toHaveCount(2);
  await expect(page.locator('#best')).toHaveText('512');
  await expect(page.locator('#notice-toast')).toContainText('损坏');
  await expect(page.locator('body')).toBeVisible();
});

test('v1 save migrates: board restored and string bestScore becomes number', async ({ page }) => {
  const cells: ({ x: number; y: number; value: number } | null)[] = [{ x: 0, y: 0, value: 2 }];
  while (cells.length < 16) cells.push(null);
  await page.addInitScript(
    ([gameState, bestScore]) => {
      localStorage.setItem('gameState', gameState);
      localStorage.setItem('bestScore', bestScore);
    },
    [
      JSON.stringify({ grid: { size: 4, cells }, score: 0, over: false, won: false, keepPlaying: false }),
      '2048',
    ] as [string, string],
  );
  await page.goto('/');
  const t = await tiles(page);
  expect(t.some((x) => x.value === 2 && x.c === 0 && x.r === 0)).toBe(true);
  await expect(page.locator('#best')).toHaveText('2,048');
});

test('OVER saves are not restored: reload starts a fresh game', async ({ page }) => {
  await injectBoard(page, '24816/42168/81624/16842', { status: 'OVER', moves: 40, score: 100 });
  await expect(page.locator('.tile')).toHaveCount(2);
  await expect(page.locator('#score')).toHaveText('0');
  await expect(page.locator('#best')).toHaveText('0');
});

test('best score persists across reloads independently of the game', async ({ page }) => {
  await injectBest(page, 4096);
  await page.goto('/');
  await expect(page.locator('#best')).toHaveText('4,096');
});
